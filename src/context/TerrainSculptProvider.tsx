import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { normalizeSceneAppearance } from '../config/sceneAppearance'
import { saveCachedHeightmapUrl } from '../config/terrainSettings'
import { useAdmin } from './AdminProvider'
import { useSandbox } from './SandboxProvider'
import { useTerrainHeightmap } from './TerrainHeightmapProvider'
import { imageDataToObjectUrl } from '../utils/demHeightmap'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { publishSculptRateLimitSeconds } from '../utils/sculptRateLimitStore'
import { normalizeTerrainLayerNudge } from '../utils/terrainLayerNudge'
import {
  canApplySculptStroke,
  recordSculptStrokeTimestamp,
  sculptCooldownSeconds,
} from '../utils/terrainSculptRateLimit'
import {
  fetchTerrainSculptCooldownSeconds,
  fetchTerrainSculptStrokes,
  recordTerrainSculptStroke,
  resetTerrainSculptStrokesOnServer,
  rowToSculptStroke,
  type TerrainSculptStrokeRow,
} from '../utils/terrainSculptDb'
import {
  applySculptBrush,
  cloneImageData,
  terrainSculptKey,
  type SculptTool,
} from '../utils/terrainSculpt'

export type SculptBrushSettings = {
  radius: number
  strength: number
}

export const DEFAULT_SCULPT_BRUSH: SculptBrushSettings = {
  radius: 10,
  strength: 1.5,
}

type SculptResult = { ok: true } | { ok: false; message: string }

type TerrainSculptContextValue = {
  brush: SculptBrushSettings
  setBrush: (patch: Partial<SculptBrushSettings>) => void
  applyStroke: (x: number, z: number, tool: SculptTool) => Promise<SculptResult>
  sculptError: string | null
  setSculptError: (message: string | null) => void
  isSculpting: boolean
  setBrushPreview: (position: [number, number, number] | null) => void
  brushPreviewRef: { current: [number, number, number] | null }
  subscribeBrushPreview: (listener: () => void) => () => void
  resetAllSculpting: (
    adminPassword?: string,
  ) => Promise<{ ok: true; deletedCount: number } | { ok: false; message: string }>
}

const TerrainSculptContext = createContext<TerrainSculptContextValue | null>(null)

export function TerrainSculptProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAdmin()
  const { settings, patchSettings, isMultiplayer, isAdminSession, pushUndo } = useSandbox()
  const { imageData, setSculptImageData, elevationContext, terrainAlignment, terrain, resetToBaseHeightmap } =
    useTerrainHeightmap()
  const heightmapNudge = normalizeTerrainLayerNudge(
    normalizeSceneAppearance(settings.sceneAppearance).terrain.layerNudges.heightmap,
  )

  const [brush, setBrushState] = useState<SculptBrushSettings>(DEFAULT_SCULPT_BRUSH)
  const [sculptError, setSculptError] = useState<string | null>(null)
  const [isSculpting, setIsSculpting] = useState(false)

  const strokeTimestampsRef = useRef<number[]>([])
  const appliedStrokeIdsRef = useRef<Set<string>>(new Set())
  const saveTimerRef = useRef<number | null>(null)
  const imageDataRef = useRef(imageData)
  imageDataRef.current = imageData

  const brushPreviewRef = useRef<[number, number, number] | null>(null)
  const brushPreviewListenersRef = useRef(new Set<() => void>())

  const setBrushPreview = useCallback((position: [number, number, number] | null) => {
    const prev = brushPreviewRef.current
    const next = position
    const unchanged =
      prev === next ||
      (prev !== null &&
        next !== null &&
        prev[0] === next[0] &&
        prev[1] === next[1] &&
        prev[2] === next[2])
    if (unchanged) return
    brushPreviewRef.current = next
    for (const listener of brushPreviewListenersRef.current) listener()
  }, [])

  const subscribeBrushPreview = useCallback((listener: () => void) => {
    brushPreviewListenersRef.current.add(listener)
    return () => brushPreviewListenersRef.current.delete(listener)
  }, [])

  const isExempt = isAdmin || isAdminSession

  const setBrush = useCallback((patch: Partial<SculptBrushSettings>) => {
    setBrushState((current) => ({
      radius: Math.min(40, Math.max(2, patch.radius ?? current.radius)),
      strength: Math.min(8, Math.max(0.1, patch.strength ?? current.strength)),
    }))
  }, [])

  const refreshCooldown = useCallback(async () => {
    if (isExempt) {
      publishSculptRateLimitSeconds(0)
      return
    }
    if (isMultiplayer && isSupabaseConfigured) {
      publishSculptRateLimitSeconds(await fetchTerrainSculptCooldownSeconds())
      return
    }
    publishSculptRateLimitSeconds(
      sculptCooldownSeconds(settings.rateLimit, strokeTimestampsRef.current, false),
    )
  }, [isExempt, isMultiplayer, settings.rateLimit])

  useEffect(() => {
    void refreshCooldown()
    const timer = window.setInterval(() => void refreshCooldown(), 1000)
    return () => window.clearInterval(timer)
  }, [refreshCooldown])

  const persistHeightmap = useCallback(
    (data: ImageData, nextSculptVersion: number) => {
      const nextTerrain = { ...terrain, sculptVersion: nextSculptVersion }
      saveCachedHeightmapUrl(nextTerrain, imageDataToObjectUrl(data))
      patchSettings({
        sceneAppearance: normalizeSceneAppearance({
          ...settings.sceneAppearance,
          terrain: nextTerrain,
        }),
      })
    },
    [patchSettings, settings.sceneAppearance, terrain],
  )

  const schedulePersist = useCallback(
    (data: ImageData) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null
        persistHeightmap(data, terrain.sculptVersion + 1)
      }, 1200)
    },
    [persistHeightmap, terrain.sculptVersion],
  )

  const applyStrokeToImage = useCallback(
    (data: ImageData, x: number, z: number, tool: SculptTool) =>
      applySculptBrush(
        data,
        terrainAlignment,
        elevationContext,
        x,
        z,
        tool,
        brush.radius,
        brush.strength,
        heightmapNudge,
      ),
    [brush.radius, brush.strength, elevationContext, heightmapNudge, terrainAlignment],
  )

  const replayStroke = useCallback(
    (stroke: {
      id?: string
      tool: SculptTool
      centerX: number
      centerZ: number
      radius: number
      strength: number
    }) => {
      if (stroke.id && appliedStrokeIdsRef.current.has(stroke.id)) return false
      const data = imageDataRef.current
      if (!data) return false
      if (stroke.id) appliedStrokeIdsRef.current.add(stroke.id)

      const working = cloneImageData(data)
      applySculptBrush(
        working,
        terrainAlignment,
        elevationContext,
        stroke.centerX,
        stroke.centerZ,
        stroke.tool,
        stroke.radius,
        stroke.strength,
        heightmapNudge,
      )
      imageDataRef.current = working
      setSculptImageData(working)
      return true
    },
    [elevationContext, heightmapNudge, setSculptImageData, terrainAlignment],
  )

  const replayStrokesBatch = useCallback(
    (strokes: {
      id?: string
      tool: SculptTool
      centerX: number
      centerZ: number
      radius: number
      strength: number
    }[]) => {
      const data = imageDataRef.current
      if (!data || strokes.length === 0) return false

      const working = cloneImageData(data)
      let changed = false

      for (const stroke of strokes) {
        if (stroke.id && appliedStrokeIdsRef.current.has(stroke.id)) continue
        if (stroke.id) appliedStrokeIdsRef.current.add(stroke.id)

        const strokeChanged = applySculptBrush(
          working,
          terrainAlignment,
          elevationContext,
          stroke.centerX,
          stroke.centerZ,
          stroke.tool,
          stroke.radius,
          stroke.strength,
          heightmapNudge,
        )
        if (strokeChanged) changed = true
      }

      if (!changed) return false

      imageDataRef.current = working
      setSculptImageData(working)
      schedulePersist(working)
      return true
    },
    [elevationContext, heightmapNudge, schedulePersist, setSculptImageData, terrainAlignment],
  )

  const applyingHistoryRef = useRef(false)

  const restoreHeightmap = useCallback(
    (data: ImageData) => {
      applyingHistoryRef.current = true
      const clone = cloneImageData(data)
      imageDataRef.current = clone
      setSculptImageData(clone)
      schedulePersist(clone)
      applyingHistoryRef.current = false
    },
    [schedulePersist, setSculptImageData],
  )

  const recordSculptUndo = useCallback(
    (before: ImageData, after: ImageData) => {
      if (applyingHistoryRef.current) return
      const beforeClone = cloneImageData(before)
      const afterClone = cloneImageData(after)
      pushUndo({
        label: 'Terrain sculpt',
        undo: () => restoreHeightmap(beforeClone),
        redo: () => restoreHeightmap(afterClone),
      })
    },
    [pushUndo, restoreHeightmap],
  )

  const applyStrokeLocal = useCallback(
    (x: number, z: number, tool: SculptTool): SculptResult => {
      const data = imageDataRef.current
      if (!data) return { ok: false, message: 'Terrain heightmap is not ready.' }

      if (!canApplySculptStroke(settings.rateLimit, strokeTimestampsRef.current, isExempt)) {
        void refreshCooldown()
        return { ok: false, message: 'Terrain sculpt rate limit reached. Please wait.' }
      }

      const before = cloneImageData(data)
      const working = cloneImageData(data)
      const changed = applyStrokeToImage(working, x, z, tool)
      if (!changed) return { ok: true }

      setSculptImageData(working)
      imageDataRef.current = working
      recordSculptUndo(before, working)
      strokeTimestampsRef.current = recordSculptStrokeTimestamp(
        strokeTimestampsRef.current,
        settings.rateLimit.terrainSculpt.windowMinutes,
      )
      schedulePersist(working)
      void refreshCooldown()
      return { ok: true }
    },
    [
      applyStrokeToImage,
      isExempt,
      refreshCooldown,
      recordSculptUndo,
      schedulePersist,
      setSculptImageData,
      settings.rateLimit,
    ],
  )

  const applyStroke = useCallback(
    async (x: number, z: number, tool: SculptTool): Promise<SculptResult> => {
      if (!imageDataRef.current) return { ok: false, message: 'Terrain heightmap is not ready.' }

      setIsSculpting(true)
      setSculptError(null)

      try {
        const terrainKey = terrainSculptKey(terrain)
        const before = cloneImageData(imageDataRef.current)

        if (isMultiplayer && isSupabaseConfigured) {
          const result = await recordTerrainSculptStroke({
            tool,
            centerX: x,
            centerZ: z,
            radius: brush.radius,
            strength: brush.strength,
            terrainKey,
          })

          if (!result.ok) {
            setSculptError(result.message)
            void refreshCooldown()
            return result
          }

          if (result.stroke.id) appliedStrokeIdsRef.current.add(result.stroke.id)

          const data = cloneImageData(imageDataRef.current)
          applyStrokeToImage(data, x, z, tool)
          setSculptImageData(data)
          imageDataRef.current = data
          recordSculptUndo(before, data)
          schedulePersist(data)
          void refreshCooldown()
          return { ok: true }
        }

        return applyStrokeLocal(x, z, tool)
      } finally {
        setIsSculpting(false)
      }
    },
    [
      applyStrokeLocal,
      applyStrokeToImage,
      brush.radius,
      brush.strength,
      isExempt,
      isMultiplayer,
      recordSculptUndo,
      refreshCooldown,
      schedulePersist,
      setSculptImageData,
      terrain,
    ],
  )

  const terrainKey = terrainSculptKey(terrain)
  const multiplayerSyncedKeyRef = useRef<string | null>(null)

  const resetAllSculpting = useCallback(
    async (
      adminPassword = '',
    ): Promise<{ ok: true; deletedCount: number } | { ok: false; message: string }> => {
      let deletedCount = 0

      if (isMultiplayer && isSupabaseConfigured) {
        const result = await resetTerrainSculptStrokesOnServer(terrainKey, adminPassword)
        if (!result.ok) return result
        deletedCount = result.deletedCount
      }

      appliedStrokeIdsRef.current = new Set()
      setSculptError(null)

      const reloaded = await resetToBaseHeightmap()
      if (!reloaded) {
        return { ok: false, message: 'Could not reload the original heightmap.' }
      }

      patchSettings({
        sceneAppearance: normalizeSceneAppearance({
          ...settings.sceneAppearance,
          terrain: { ...terrain, sculptVersion: 0 },
        }),
      })

      return { ok: true, deletedCount }
    },
    [
      isMultiplayer,
      patchSettings,
      resetToBaseHeightmap,
      settings.sceneAppearance,
      terrain,
      terrainKey,
    ],
  )

  useEffect(() => {
    if (terrain.sculptVersion === 0) {
      appliedStrokeIdsRef.current = new Set()
    }
  }, [terrain.sculptVersion])

  // Initial stroke replay once per terrain key when heightmap is ready — not on every local sculpt edit.
  useEffect(() => {
    if (!isMultiplayer || !supabase || !imageData) return
    if (multiplayerSyncedKeyRef.current === terrainKey) return
    multiplayerSyncedKeyRef.current = terrainKey

    appliedStrokeIdsRef.current = new Set()
    void fetchTerrainSculptStrokes(terrainKey).then((strokes) => {
      replayStrokesBatch(strokes)
    })
  }, [isMultiplayer, imageData, replayStrokesBatch, terrainKey])

  useEffect(() => {
    if (!isMultiplayer || !supabase) return

    const channel = supabase
      .channel(`terrain_sculpt_${terrainKey}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'terrain_sculpt_strokes',
          filter: `terrain_key=eq.${terrainKey}`,
        },
        (payload) => {
          replayStroke(rowToSculptStroke(payload.new as TerrainSculptStrokeRow))
        },
      )
      .subscribe()

    const client = supabase

    return () => {
      void client.removeChannel(channel)
    }
  }, [isMultiplayer, replayStroke, terrainKey])

  const value = useMemo<TerrainSculptContextValue>(
    () => ({
      brush,
      setBrush,
      applyStroke,
      sculptError,
      setSculptError,
      isSculpting,
      setBrushPreview,
      brushPreviewRef,
      subscribeBrushPreview,
      resetAllSculpting,
    }),
    [
      applyStroke,
      brush,
      isSculpting,
      resetAllSculpting,
      sculptError,
      setBrushPreview,
      subscribeBrushPreview,
    ],
  )

  return <TerrainSculptContext.Provider value={value}>{children}</TerrainSculptContext.Provider>
}

export function useTerrainSculpt(): TerrainSculptContextValue {
  const context = useContext(TerrainSculptContext)
  if (!context) {
    throw new Error('useTerrainSculpt must be used within TerrainSculptProvider')
  }
  return context
}
