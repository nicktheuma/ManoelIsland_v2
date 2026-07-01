import { useState, useEffect, useMemo } from 'react'
import { getAdminPassword } from '../../config/defaults'
import { DEFAULT_CAMERA_SETTINGS } from '../../config/cameraSettings'
import { DEFAULT_FOG_SETTINGS, FOG_FAR_MAX, FOG_FAR_MIN, FOG_NEAR_MAX, FOG_NEAR_MIN } from '../../config/fogSettings'
import { DEFAULT_SCENE_APPEARANCE, HDRI_OPTIONS, normalizeSceneAppearance } from '../../config/sceneAppearance'
import {
  DEFAULT_TERRAIN_SETTINGS,
  MANOEL_ISLAND_POLYGON,
  TERRAIN_SAMPLE_SIZE_OPTIONS,
  TERRAIN_SURFACE_SAMPLE_SIZE_OPTIONS,
  TERRAIN_SURFACE_STYLE_OPTIONS,
  TERRAIN_MESH_QUALITY_OPTIONS,
} from '../../config/terrainSettings'
import {
  getDefaultWaterSettings,
  saveWaterSettingsAsDefaults,
  WATER_DETAIL_LAYER_OPTIONS,
  WATER_DETAIL_SCALE_MAX,
  WATER_DETAIL_SCALE_MIN,
  WATER_DISTORTION_MAX,
  WATER_DISTORTION_SLIDER_SCALE,
  WATER_DISTORTION_SPEED_MAX,
  WATER_EDGE_RIPPLE_FALLOFF_MAX,
  WATER_EDGE_RIPPLE_MAX_DISTANCE_MAX,
  WATER_EDGE_RIPPLE_SPEED_MAX,
  WATER_EDGE_RIPPLE_WAVE_SCALE_MAX,
  WATER_EDGE_RIPPLE_WAVE_SCALE_MIN,
  WATER_SHORELINE_FADE_DISTANCE_MAX,
  WATER_MESH_QUALITY_OPTIONS,
  WATER_NORMAL_LAYER_OPTIONS,
  WATER_NORMAL_LAYER_STRENGTH_MAX,
  WATER_NORMAL_LAYER_STRETCH_MAX,
  WATER_NORMAL_LAYER_STRETCH_MIN,
  WATER_NORMAL_MAP_SCALE_MAX,
  WATER_NORMAL_MAP_SCALE_MIN,
  WATER_NORMAL_MAP_SPEED_MAX,
  WATER_NORMAL_COLOR_SCALE_MAX,
  WATER_NORMAL_MAP_WAVE_SCALE_MAX,
  WATER_NORMAL_MAP_WAVE_SCALE_MIN,
  WATER_STYLE_OPTIONS,
  WATER_WAVE_SCALE_MAX,
  WATER_WAVE_SCALE_MIN,
} from '../../config/waterSettings'
import { useAdmin } from '../../context/AdminProvider'
import { useSandbox } from '../../context/SandboxProvider'
import { useTerrainHeightmap } from '../../context/TerrainHeightmapProvider'
import { useTerrainSculpt } from '../../context/TerrainSculptProvider'
import { useAdminPanelLayout, type AdminPanelSectionId } from '../../hooks/useAdminPanelLayout'
import type { PropDefinition } from '../../types/propLibrary'
import type { CameraSettings, FogSettings, LatLng, PropRateLimit, SceneAppearance, TerrainLayerNudges, TerrainSettings, WaterBaseNormalSettings, WaterEdgeRippleSettings, WaterMeshQuality, WaterNormalLayerSettings, WaterSettings } from '../../types/sandbox'
import { getPropRateLimit } from '../../utils/rateLimitSettings'
import { useAdminSceneAppearanceDraft } from '../../hooks/useAdminSceneAppearanceDraft'
import { HeightmapMapPicker } from './HeightmapMapPicker'
import { TerrainLayerNudgePanels } from './TerrainLayerNudgeControls'
import { VisibilityToggle } from './VisibilityToggle'

function AdminSection({
  title,
  expanded,
  onToggleExpanded,
  visible,
  onToggleVisibility,
  showVisibilityToggle = true,
  children,
}: {
  title: string
  expanded: boolean
  onToggleExpanded: () => void
  visible?: boolean
  onToggleVisibility?: () => void
  showVisibilityToggle?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950/60">
      <div className="flex items-center justify-between gap-2 p-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={expanded}
        >
          <span className="shrink-0 text-xs text-slate-500" aria-hidden>
            {expanded ? '▼' : '▶'}
          </span>
          <h3 className="truncate text-sm font-medium text-slate-200">{title}</h3>
        </button>
        {showVisibilityToggle && visible !== undefined && onToggleVisibility && (
          <VisibilityToggle visible={visible} onToggle={onToggleVisibility} />
        )}
      </div>
      {expanded && <div className="space-y-3 border-t border-slate-800/80 px-3 pb-3 pt-3">{children}</div>}
    </section>
  )
}

export function AdminPanel() {
  const { isAdmin, isPanelOpen, togglePanel, logout, zoneDrawingMode, setZoneDrawingMode, draftZonePoints, clearDraftZone, finishDraftZone, adminProfile, isSupabaseAdmin } = useAdmin()
  const { settings, setSettings, patchSettings, placedProps, canUndo, canRedo, undo, redo, syncRateLimitSettings, syncSceneAppearanceSettings, isAdminSession, isMultiplayer, wipeMapClutter, wipeAllProps, setLayoutLocked, isLayoutLocked, captureCameraView } = useSandbox()
  const [zoneName, setZoneName] = useState('Allowed Zone')
  const [rateLimitMessage, setRateLimitMessage] = useState<string | null>(null)
  const [sceneMessage, setSceneMessage] = useState<string | null>(null)
  const [isSavingScene, setIsSavingScene] = useState(false)
  const [isSavingRateLimits, setIsSavingRateLimits] = useState(false)
  const [mapOpMessage, setMapOpMessage] = useState<string | null>(null)
  const [isMapOpRunning, setIsMapOpRunning] = useState(false)
  const [terrainDrawing, setTerrainDrawing] = useState(false)
  const [draftTerrainPolygon, setDraftTerrainPolygon] = useState<LatLng[]>(() =>
    normalizeSceneAppearance(settings.sceneAppearance).terrain.polygon,
  )
  const [terrainMessage, setTerrainMessage] = useState<string | null>(null)
  const [isGeneratingTerrain, setIsGeneratingTerrain] = useState(false)
  const [isGeneratingSurface, setIsGeneratingSurface] = useState(false)
  const [isGeneratingOsm, setIsGeneratingOsm] = useState(false)
  const [isRefreshingSurround, setIsRefreshingSurround] = useState(false)
  const { scrollRef, toggleSection, isExpanded } = useAdminPanelLayout(isPanelOpen)
  const {
    isLoading: isHeightmapLoading,
    progress: heightmapProgress,
    error: heightmapError,
    generateFromPolygon,
    isSurfaceLoading,
    surfaceProgress,
    surfaceError,
    generateSurfaceFromPolygon,
    isOsmFeaturesLoading,
    osmFeaturesProgress,
    osmFeaturesError,
    generateOsmFeaturesFromPolygon,
    isSurroundLoading,
    surroundError,
    refreshSurroundTerrain,
  } = useTerrainHeightmap()
  const { resetAllSculpting } = useTerrainSculpt()

  const committedSceneAppearance = useMemo(
    () => normalizeSceneAppearance(settings.sceneAppearance),
    [settings.sceneAppearance],
  )

  const { sceneAppearance, applySceneAppearance } = useAdminSceneAppearanceDraft({
    committed: committedSceneAppearance,
    patchSettings,
    syncSceneAppearanceSettings,
    isMultiplayer,
    getAdminPassword,
    onLocalMessage: setSceneMessage,
    onSyncStart: () => setIsSavingScene(true),
    onSyncEnd: (message) => {
      setIsSavingScene(false)
      if (message) setSceneMessage(message)
    },
  })

  useEffect(() => {
    if (!terrainDrawing && !isGeneratingTerrain) {
      setDraftTerrainPolygon([...sceneAppearance.terrain.polygon])
    }
  }, [sceneAppearance.terrain.version, terrainDrawing, isGeneratingTerrain])

  if (!isAdmin || !isPanelOpen) return null

  const section = (id: AdminPanelSectionId) => ({
    expanded: isExpanded(id),
    onToggleExpanded: () => toggleSection(id),
  })

  const updateRules = (patch: Partial<typeof settings.placementRules>) => {
    patchSettings({
      placementRules: { ...settings.placementRules, ...patch },
    })
  }

  const updateVisibility = (patch: Partial<typeof settings.userVisibility>) => {
    patchSettings({
      userVisibility: { ...settings.userVisibility, ...patch },
    })
  }

  const toggleCategoryVisibility = (categoryId: string) => {
    setSettings({
      ...settings,
      categories: settings.categories.map((category) =>
        category.id === categoryId
          ? { ...category, userVisible: !category.userVisible }
          : category,
      ),
    })
  }

  const togglePropPlaceable = (propId: string) => {
    setSettings({
      ...settings,
      propLibrary: settings.propLibrary.map((prop) =>
        prop.id === propId ? { ...prop, userPlaceable: !prop.userPlaceable } : prop,
      ),
    })
  }

  const updatePropPlacement = (
    propId: string,
    patch: Partial<PropDefinition['placement']>,
  ) => {
    setSettings({
      ...settings,
      propLibrary: settings.propLibrary.map((prop) =>
        prop.id === propId
          ? { ...prop, placement: { ...prop.placement, ...patch } }
          : prop,
      ),
    })
  }

  const updatePropVariation = (
    propId: string,
    patch: Partial<PropDefinition['variation']>,
  ) => {
    setSettings({
      ...settings,
      propLibrary: settings.propLibrary.map((prop) =>
        prop.id === propId
          ? { ...prop, variation: { ...prop.variation, ...patch } }
          : prop,
      ),
    })
  }

  const togglePropZone = (propId: string, zoneId: string) => {
    const prop = settings.propLibrary.find((item) => item.id === propId)
    if (!prop) return
    const allowed = new Set(prop.placement.allowedZoneIds)
    if (allowed.has(zoneId)) allowed.delete(zoneId)
    else allowed.add(zoneId)
    updatePropPlacement(propId, { allowedZoneIds: [...allowed] })
  }

  const updateRateLimit = (patch: Partial<typeof settings.rateLimit>) => {
    patchSettings({
      rateLimit: { ...settings.rateLimit, ...patch },
    })
  }

  const updatePropRateLimit = (propId: string, patch: Partial<PropRateLimit>) => {
    const current = settings.rateLimit.perProp[propId] ?? {
      enabled: true,
      maxPlacements: settings.rateLimit.maxPlacements,
      windowMinutes: settings.rateLimit.windowMinutes,
    }
    updateRateLimit({
      perProp: {
        ...settings.rateLimit.perProp,
        [propId]: { ...current, ...patch },
      },
    })
  }

  const handleSaveRateLimits = async () => {
    if (!isMultiplayer) {
      setRateLimitMessage('Rate limits saved locally. Connect Supabase to enforce on the server.')
      return
    }

    setIsSavingRateLimits(true)
    setRateLimitMessage(null)
    const result = await syncRateLimitSettings(getAdminPassword())
    setIsSavingRateLimits(false)
    setRateLimitMessage(result.ok ? 'Rate limits applied to server.' : result.message)
  }

  const handleWipeMap = async () => {
    if (!window.confirm('Remove all props placed by non-admin users? This cannot be undone.')) return

    setIsMapOpRunning(true)
    setMapOpMessage(null)
    const result = await wipeMapClutter()
    setIsMapOpRunning(false)
    setMapOpMessage(result.ok ? `Removed ${result.deletedCount} props.` : result.message)
  }

  const handleDeleteAllProps = async () => {
    if (
      !window.confirm(
        'Delete every prop on the map, including admin placements? This cannot be undone.',
      )
    ) {
      return
    }

    setIsMapOpRunning(true)
    setMapOpMessage(null)
    const beforeCount = placedProps.length
    const result = await wipeAllProps(getAdminPassword())
    setIsMapOpRunning(false)
    if (!result.ok) {
      setMapOpMessage(result.message)
      return
    }
    if (result.deletedCount === 0 && beforeCount > 0) {
      setMapOpMessage(
        'No props were deleted. Re-login as admin (P) and run the wipe_all_props SQL migration in Supabase.',
      )
      return
    }
    setMapOpMessage(`Deleted all ${result.deletedCount} props.`)
  }

  const handleResetSculpting = async () => {
    if (
      !window.confirm(
        'Reset all terrain sculpting to the original heightmap? This cannot be undone.',
      )
    ) {
      return
    }

    setIsMapOpRunning(true)
    setMapOpMessage(null)
    const result = await resetAllSculpting(getAdminPassword())
    if (!result.ok) {
      setIsMapOpRunning(false)
      setMapOpMessage(result.message)
      return
    }

    applySceneAppearance(
      normalizeSceneAppearance({
        ...sceneAppearance,
        terrain: { ...sceneAppearance.terrain, sculptVersion: 0 },
      }),
      { immediate: true },
    )

    setIsMapOpRunning(false)
    const strokeNote =
      isMultiplayer && result.deletedCount > 0
        ? ` Cleared ${result.deletedCount} stored stroke(s).`
        : ''
    setMapOpMessage(`Terrain sculpting reset to the original heightmap.${strokeNote}`)
  }

  const handleLockLayout = async () => {
    setIsMapOpRunning(true)
    setMapOpMessage(null)
    const result = await setLayoutLocked(true)
    setIsMapOpRunning(false)
    setMapOpMessage(result.ok ? 'Layout locked. New placements disabled for visitors.' : result.message)
  }

  const handleUnlockLayout = async () => {
    setIsMapOpRunning(true)
    setMapOpMessage(null)
    const result = await setLayoutLocked(false)
    setIsMapOpRunning(false)
    setMapOpMessage(result.ok ? 'Layout unlocked. Visitors can place props again.' : result.message)
  }

  const updateSceneAppearance = (patch: Partial<SceneAppearance>) => {
    applySceneAppearance({ ...sceneAppearance, ...patch })
  }

  const resetSceneAppearance = () => {
    applySceneAppearance(DEFAULT_SCENE_APPEARANCE, { immediate: true })
  }

  const updateWater = (patch: Partial<WaterSettings>) => {
    applySceneAppearance(
      {
        ...sceneAppearance,
        water: { ...sceneAppearance.water, ...patch },
      },
      { immediate: true },
    )
  }

  const updateNormalLayer = (index: number, patch: Partial<WaterNormalLayerSettings>) => {
    const layers = [...sceneAppearance.water.normalLayerSettings] as WaterSettings['normalLayerSettings']
    layers[index] = { ...layers[index], ...patch }
    updateWater({ normalLayerSettings: layers })
  }

  const updateBaseNormalMap = (patch: Partial<WaterBaseNormalSettings>) => {
    updateWater({
      baseNormalMap: { ...sceneAppearance.water.baseNormalMap, ...patch },
    })
  }

  const updateEdgeRipples = (patch: Partial<WaterEdgeRippleSettings>) => {
    updateWater({
      edgeRipples: { ...sceneAppearance.water.edgeRipples, ...patch },
    })
  }

  const resetWater = () => {
    applySceneAppearance(
      {
        ...sceneAppearance,
        water: getDefaultWaterSettings(),
      },
      { immediate: true },
    )
  }

  const saveWaterDefaults = () => {
    saveWaterSettingsAsDefaults(sceneAppearance.water)
    setSceneMessage('Saved current water settings as defaults for this browser.')
  }

  const updateFog = (patch: Partial<FogSettings>) => {
    applySceneAppearance(
      {
        ...sceneAppearance,
        fog: { ...sceneAppearance.fog, ...patch },
      },
      { immediate: true },
    )
  }

  const resetFog = () => {
    applySceneAppearance(
      {
        ...sceneAppearance,
        fog: DEFAULT_FOG_SETTINGS,
      },
      { immediate: true },
    )
  }

  const updateCamera = (patch: Partial<CameraSettings>) => {
    applySceneAppearance({
      ...sceneAppearance,
      camera: { ...sceneAppearance.camera, ...patch },
    })
  }

  const resetCamera = () => {
    applySceneAppearance(
      {
        ...sceneAppearance,
        camera: DEFAULT_CAMERA_SETTINGS,
      },
      { immediate: true },
    )
  }

  const saveCurrentCameraView = () => {
    const captured = captureCameraView()
    if (!captured) {
      setSceneMessage('Could not read the live camera. Orbit the scene and try again.')
      return
    }

    applySceneAppearance(
      {
        ...sceneAppearance,
        camera: { ...sceneAppearance.camera, ...captured },
      },
      { immediate: true },
    )
    setSceneMessage('Saved current view as the default starting camera.')
  }

  const updateTerrain = (patch: Partial<TerrainSettings>) => {
    applySceneAppearance({
      ...sceneAppearance,
      terrain: { ...sceneAppearance.terrain, ...patch },
    })
  }

  const updateLayerNudge = (
    layer: keyof TerrainLayerNudges,
    patch: Partial<TerrainLayerNudges[typeof layer]>,
  ) => {
    applySceneAppearance(
      {
        ...sceneAppearance,
        terrain: {
          ...sceneAppearance.terrain,
          layerNudges: {
            ...sceneAppearance.terrain.layerNudges,
            [layer]: { ...sceneAppearance.terrain.layerNudges[layer], ...patch },
          },
        },
      },
      { immediate: true },
    )
  }

  const resetLayerNudge = (layer: keyof TerrainLayerNudges) => {
    applySceneAppearance(
      {
        ...sceneAppearance,
        terrain: {
          ...sceneAppearance.terrain,
          layerNudges: {
            ...sceneAppearance.terrain.layerNudges,
            [layer]: { ...DEFAULT_TERRAIN_SETTINGS.layerNudges[layer] },
          },
        },
      },
      { immediate: true },
    )
  }

  const resetLayerNudges = () => {
    applySceneAppearance(
      {
        ...sceneAppearance,
        terrain: {
          ...sceneAppearance.terrain,
          layerNudges: { ...DEFAULT_TERRAIN_SETTINGS.layerNudges },
        },
      },
      { immediate: true },
    )
  }

  const handleFetchElevation = async () => {
    if (draftTerrainPolygon.length < 3) {
      setTerrainMessage('Draw at least 3 points on the map.')
      return
    }

    setIsGeneratingTerrain(true)
    setTerrainMessage(null)

    const nextTerrain = await generateFromPolygon(draftTerrainPolygon, {
      sampleSize: sceneAppearance.terrain.sampleSize,
      maxHeight: sceneAppearance.terrain.maxHeight,
    })

    setIsGeneratingTerrain(false)

    if (!nextTerrain) {
      setTerrainMessage('Failed to generate elevation data.')
      return
    }

    const committed = normalizeSceneAppearance(settings.sceneAppearance)
    const hadSurface =
      committed.terrain.surfaceVersion > 0 && committed.terrain.surfaceStyle !== 'grid'

    applySceneAppearance(
      {
        ...committed,
          terrain: {
          ...nextTerrain,
          surfaceVersion: 0,
          sculptVersion: 0,
          lastSurfaceZoom: null,
        },
      },
      { immediate: true },
    )
    setTerrainDrawing(false)
    setTerrainMessage(
      hadSurface
        ? `Applied real elevation (${nextTerrain.lastMinElevation?.toFixed(1)}–${nextTerrain.lastMaxElevation?.toFixed(1)} m). Re-fetch surface to realign the orthophoto.`
        : `Applied real elevation (${nextTerrain.lastMinElevation?.toFixed(1)}–${nextTerrain.lastMaxElevation?.toFixed(1)} m, zoom ${nextTerrain.lastZoom}).`,
    )
  }

  const handleRefreshSurround = async () => {
    if (sceneAppearance.terrain.source !== 'dem') {
      setTerrainMessage('Fetch elevation first to enable distant surround terrain.')
      return
    }

    setIsRefreshingSurround(true)
    setTerrainMessage(null)

    const nextTerrain = await refreshSurroundTerrain()
    setIsRefreshingSurround(false)

    if (!nextTerrain) {
      setTerrainMessage('Failed to refresh distant surround terrain.')
      return
    }

    applySceneAppearance(
      {
        ...sceneAppearance,
        terrain: nextTerrain,
      },
      { immediate: true },
    )
    setTerrainMessage('Refreshed distant surround terrain.')
  }

  const handleFetchOsmFeatures = async () => {
    if (draftTerrainPolygon.length < 3) {
      setTerrainMessage('Draw at least 3 points on the map.')
      return
    }

    if (sceneAppearance.terrain.source !== 'dem' || sceneAppearance.terrain.version < 1) {
      setTerrainMessage('Fetch elevation first so buildings and trees sit on real terrain.')
      return
    }

    setIsGeneratingOsm(true)
    setTerrainMessage(null)

    const nextTerrain = await generateOsmFeaturesFromPolygon(draftTerrainPolygon)

    setIsGeneratingOsm(false)

    if (!nextTerrain) {
      setTerrainMessage('Failed to fetch OSM buildings and trees.')
      return
    }

    applySceneAppearance(
      {
        ...sceneAppearance,
        terrain: nextTerrain,
      },
      { immediate: true },
    )
    setTerrainDrawing(false)
    setTerrainMessage('Applied OSM buildings and trees from OpenStreetMap.')
  }

  const resetTerrainDraft = () => {
    setDraftTerrainPolygon([...sceneAppearance.terrain.polygon])
    setTerrainDrawing(false)
  }

  const handleFetchSurface = async () => {
    if (draftTerrainPolygon.length < 3) {
      setTerrainMessage('Draw at least 3 points on the map.')
      return
    }

    if (sceneAppearance.terrain.surfaceStyle === 'grid') {
      setTerrainMessage('Choose orthophoto or simplified site map first.')
      return
    }

    if (sceneAppearance.terrain.source !== 'dem' || sceneAppearance.terrain.version < 1) {
      setTerrainMessage('Fetch elevation first so the surface uses the same geo reference.')
      return
    }

    setIsGeneratingSurface(true)
    setTerrainMessage(null)

    const nextTerrain = await generateSurfaceFromPolygon(draftTerrainPolygon, {
      surfaceSampleSize: sceneAppearance.terrain.surfaceSampleSize,
      surfaceStyle: sceneAppearance.terrain.surfaceStyle,
    })

    setIsGeneratingSurface(false)

    if (!nextTerrain) {
      setTerrainMessage('Failed to generate terrain surface.')
      return
    }

    const committed = normalizeSceneAppearance(settings.sceneAppearance)
    applySceneAppearance(
      {
        ...committed,
        terrain: nextTerrain,
      },
      { immediate: true },
    )
    setTerrainDrawing(false)
    setTerrainMessage(
      nextTerrain.surfaceStyle === 'orthophoto'
        ? `Orthophoto applied${nextTerrain.lastSurfaceZoom !== null ? ` (zoom ${nextTerrain.lastSurfaceZoom})` : ''}.`
        : 'Simplified site map applied.',
    )
  }

  return (
    <aside className="pointer-events-auto absolute right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-slate-800 bg-slate-900/95 shadow-2xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-white">Admin Panel</h2>
          <p className="text-xs text-slate-400">
            {placedProps.length} props on map
            {isSupabaseAdmin && adminProfile?.username ? ` · ${adminProfile.username}` : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={togglePanel} className="rounded-lg px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800">
            Hide
          </button>
          <button type="button" onClick={logout} className="rounded-lg px-3 py-1.5 text-sm text-red-300 hover:bg-slate-800">
            Logout
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        <AdminSection
          title="Scene Appearance"
          showVisibilityToggle={false}
          {...section('sceneAppearance')}
        >
          <p className="text-xs text-slate-400">
            HDRI lighting and canvas colors apply to everyone when Supabase is connected.
          </p>

          <label className="block text-sm text-slate-300">
            HDRI environment
            <select
              value={sceneAppearance.hdriPreset}
              onChange={(event) =>
                updateSceneAppearance({ hdriPreset: event.target.value as SceneAppearance['hdriPreset'] })
              }
              disabled={isSavingScene}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            >
              {HDRI_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs text-slate-400">
              Background
              <input
                type="color"
                value={sceneAppearance.backgroundColor}
                onChange={(event) => updateSceneAppearance({ backgroundColor: event.target.value })}
                disabled={isSavingScene}
                className="mt-1 h-9 w-full cursor-pointer rounded border border-slate-700 bg-slate-950"
              />
            </label>
            <label className="text-xs text-slate-400">
              Terrain fill
              <input
                type="color"
                value={sceneAppearance.terrainFillColor}
                onChange={(event) => updateSceneAppearance({ terrainFillColor: event.target.value })}
                disabled={isSavingScene}
                className="mt-1 h-9 w-full cursor-pointer rounded border border-slate-700 bg-slate-950"
              />
            </label>
            <label className="text-xs text-slate-400">
              Terrain grid
              <input
                type="color"
                value={sceneAppearance.terrainGridColor}
                onChange={(event) => updateSceneAppearance({ terrainGridColor: event.target.value })}
                disabled={isSavingScene}
                className="mt-1 h-9 w-full cursor-pointer rounded border border-slate-700 bg-slate-950"
              />
            </label>
          </div>

          <label className="block text-xs text-slate-400">
            Terrain fill opacity ({Math.round(sceneAppearance.terrainFillOpacity * 100)}%)
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(sceneAppearance.terrainFillOpacity * 100)}
              onChange={(event) =>
                updateSceneAppearance({ terrainFillOpacity: Number(event.target.value) / 100 })
              }
              disabled={isSavingScene}
              className="mt-1 w-full accent-cyan-500"
            />
          </label>

          <button
            type="button"
            onClick={resetSceneAppearance}
            disabled={isSavingScene}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Reset to defaults
          </button>
          {sceneMessage && <p className="text-xs text-slate-400">{sceneMessage}</p>}
        </AdminSection>

        <AdminSection title="Camera" showVisibilityToggle={false} {...section('camera')}>
          <p className="text-xs text-slate-400">
            Starting view and orbit limits. Syncs for all visitors when Supabase is connected.
          </p>

          <div className="grid grid-cols-3 gap-2">
            {(['X', 'Y', 'Z'] as const).map((axis, index) => (
              <label key={`pos-${axis}`} className="text-xs text-slate-400">
                Position {axis}
                <input
                  type="number"
                  step={1}
                  value={sceneAppearance.camera.position[index]}
                  onChange={(event) => {
                    const next = [...sceneAppearance.camera.position] as [number, number, number]
                    next[index] = Number(event.target.value)
                    updateCamera({ position: next })
                  }}
                  disabled={isSavingScene}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white disabled:opacity-40"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['X', 'Y', 'Z'] as const).map((axis, index) => (
              <label key={`target-${axis}`} className="text-xs text-slate-400">
                Target {axis}
                <input
                  type="number"
                  step={1}
                  value={sceneAppearance.camera.target[index]}
                  onChange={(event) => {
                    const next = [...sceneAppearance.camera.target] as [number, number, number]
                    next[index] = Number(event.target.value)
                    updateCamera({ target: next })
                  }}
                  disabled={isSavingScene}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white disabled:opacity-40"
                />
              </label>
            ))}
          </div>

          <label className="block text-xs text-slate-400">
            Field of view ({Math.round(sceneAppearance.camera.fov)}°)
            <input
              type="range"
              min={20}
              max={100}
              value={Math.round(sceneAppearance.camera.fov)}
              onChange={(event) => updateCamera({ fov: Number(event.target.value) })}
              disabled={isSavingScene}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Clip near plane ({sceneAppearance.camera.near.toFixed(2)} units)
            <input
              type="range"
              min={0.01}
              max={10}
              step={0.01}
              value={sceneAppearance.camera.near}
              onChange={(event) => updateCamera({ near: Number(event.target.value) })}
              disabled={isSavingScene}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Clip far plane ({Math.round(sceneAppearance.camera.far)} units)
            <input
              type="range"
              min={100}
              max={5000}
              step={10}
              value={Math.round(sceneAppearance.camera.far)}
              onChange={(event) => updateCamera({ far: Number(event.target.value) })}
              disabled={isSavingScene}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Min zoom distance ({Math.round(sceneAppearance.camera.minDistance)} units)
            <input
              type="range"
              min={5}
              max={300}
              value={Math.round(sceneAppearance.camera.minDistance)}
              onChange={(event) => updateCamera({ minDistance: Number(event.target.value) })}
              disabled={isSavingScene}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Max zoom distance ({Math.round(sceneAppearance.camera.maxDistance)} units)
            <input
              type="range"
              min={50}
              max={2000}
              value={Math.round(sceneAppearance.camera.maxDistance)}
              onChange={(event) => updateCamera({ maxDistance: Number(event.target.value) })}
              disabled={isSavingScene}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Max pitch ({Math.round(sceneAppearance.camera.maxPolarAngleDeg)}°)
            <input
              type="range"
              min={30}
              max={90}
              value={Math.round(sceneAppearance.camera.maxPolarAngleDeg)}
              onChange={(event) => updateCamera({ maxPolarAngleDeg: Number(event.target.value) })}
              disabled={isSavingScene}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <button
            type="button"
            onClick={saveCurrentCameraView}
            disabled={isSavingScene}
            className="rounded-lg bg-cyan-700 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Save current view as default
          </button>

          <button
            type="button"
            onClick={resetCamera}
            disabled={isSavingScene}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Reset camera defaults
          </button>
        </AdminSection>

        <AdminSection title="Terrain heightmap" showVisibilityToggle={false} {...section('terrain')}>
          <p className="text-xs text-slate-400">
            Draw an outline on the map to define real-world elevation bounds. Heightmaps use a fixed global coordinate
            system so future imports stay aligned. Data is cached locally; settings sync via Supabase.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">
              Origin latitude (world 0,0)
              <input
                type="number"
                step={0.0001}
                value={sceneAppearance.terrain.originLat}
                onChange={(event) => updateTerrain({ originLat: Number(event.target.value) })}
                disabled={isSavingScene || isGeneratingTerrain}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white disabled:opacity-40"
              />
            </label>
            <label className="text-xs text-slate-400">
              Origin longitude (world 0,0)
              <input
                type="number"
                step={0.0001}
                value={sceneAppearance.terrain.originLng}
                onChange={(event) => updateTerrain({ originLng: Number(event.target.value) })}
                disabled={isSavingScene || isGeneratingTerrain}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white disabled:opacity-40"
              />
            </label>
            <label className="text-xs text-slate-400">
              Lat span (terrain height)
              <input
                type="number"
                min={0.001}
                max={0.5}
                step={0.0001}
                value={sceneAppearance.terrain.spanLat}
                onChange={(event) => updateTerrain({ spanLat: Number(event.target.value) })}
                disabled={isSavingScene || isGeneratingTerrain}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white disabled:opacity-40"
              />
            </label>
            <label className="text-xs text-slate-400">
              Lng span (terrain width)
              <input
                type="number"
                min={0.001}
                max={0.5}
                step={0.0001}
                value={sceneAppearance.terrain.spanLng}
                onChange={(event) => updateTerrain({ spanLng: Number(event.target.value) })}
                disabled={isSavingScene || isGeneratingTerrain}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white disabled:opacity-40"
              />
            </label>
          </div>

          <HeightmapMapPicker
            polygon={draftTerrainPolygon}
            drawingEnabled={terrainDrawing}
            onAddPoint={(point) => {
              if (!terrainDrawing) return
              setDraftTerrainPolygon((current) => [...current, point])
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setTerrainDrawing(!terrainDrawing)}
              className={`rounded-lg px-3 py-2 text-sm ${
                terrainDrawing ? 'bg-amber-500 text-black' : 'bg-slate-800 text-white'
              }`}
            >
              {terrainDrawing ? 'Drawing…' : 'Draw outline'}
            </button>
            <button
              type="button"
              onClick={() => setDraftTerrainPolygon((current) => current.slice(0, -1))}
              disabled={draftTerrainPolygon.length === 0}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              Undo point
            </button>
            <button
              type="button"
              onClick={() => setDraftTerrainPolygon([])}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setDraftTerrainPolygon([...MANOEL_ISLAND_POLYGON])}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white"
            >
              Manoel preset
            </button>
            <button
              type="button"
              onClick={resetTerrainDraft}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white"
            >
              Reset draft
            </button>
          </div>

          <p className="text-xs text-slate-500">
            {draftTerrainPolygon.length} draft points (minimum 3). Applied outline has{' '}
            {sceneAppearance.terrain.polygon.length} points (v{sceneAppearance.terrain.version}).
          </p>

          <label className="block text-sm text-slate-300">
            Heightmap source
            <select
              value={sceneAppearance.terrain.source}
              onChange={(event) =>
                updateTerrain({ source: event.target.value as TerrainSettings['source'] })
              }
              disabled={isSavingScene || isGeneratingTerrain}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-40"
            >
              <option value="dem">Real elevation (DEM)</option>
              <option value="procedural">Procedural placeholder</option>
            </select>
          </label>

          <label className="block text-sm text-slate-300">
            Heightmap sample resolution
            <select
              value={sceneAppearance.terrain.sampleSize}
              onChange={(event) =>
                updateTerrain({ sampleSize: Number(event.target.value) as TerrainSettings['sampleSize'] })
              }
              disabled={isSavingScene || isGeneratingTerrain}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-40"
            >
              {TERRAIN_SAMPLE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}×{size} elevation
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-300">
            Terrain mesh quality
            <select
              value={sceneAppearance.terrain.meshQuality}
              onChange={(event) =>
                updateTerrain({ meshQuality: event.target.value as TerrainSettings['meshQuality'] })
              }
              disabled={isSavingScene || isGeneratingTerrain}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-40"
            >
              {TERRAIN_MESH_QUALITY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-slate-400">
            Height exaggeration ({sceneAppearance.terrain.maxHeight.toFixed(2)}×, 1 = real-world scale)
            <input
              type="range"
              min={0.25}
              max={5}
              step={0.05}
              value={sceneAppearance.terrain.maxHeight}
              onChange={(event) => updateTerrain({ maxHeight: Number(event.target.value) })}
              disabled={isSavingScene || isGeneratingTerrain}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <hr className="border-slate-800" />

          <p className="text-xs text-slate-400">
            Distant surround: a low-detail terrain ring outside the island outline for far-context views.
            Generated automatically when elevation is fetched.
          </p>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={sceneAppearance.terrain.surroundEnabled}
              onChange={(event) =>
                updateTerrain({
                  surroundEnabled: event.target.checked,
                  surroundVersion: sceneAppearance.terrain.surroundVersion + 1,
                })
              }
              disabled={isSavingScene || isGeneratingTerrain || isRefreshingSurround}
              className="rounded border-slate-600"
            />
            Show distant surround terrain
          </label>

          <label className="block text-xs text-slate-400">
            Surround extent ({sceneAppearance.terrain.surroundScale.toFixed(1)}× main terrain size)
            <input
              type="range"
              min={1.6}
              max={4}
              step={0.1}
              value={sceneAppearance.terrain.surroundScale}
              onChange={(event) =>
                updateTerrain({
                  surroundScale: Number(event.target.value),
                  surroundVersion: sceneAppearance.terrain.surroundVersion + 1,
                })
              }
              disabled={
                isSavingScene ||
                isGeneratingTerrain ||
                isRefreshingSurround ||
                !sceneAppearance.terrain.surroundEnabled
              }
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Surround opacity ({Math.round(sceneAppearance.terrain.surroundOpacity * 100)}%)
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.02}
              value={sceneAppearance.terrain.surroundOpacity}
              onChange={(event) => updateTerrain({ surroundOpacity: Number(event.target.value) })}
              disabled={isSavingScene || !sceneAppearance.terrain.surroundEnabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-sm text-slate-300">
            Surround mesh detail
            <select
              value={sceneAppearance.terrain.surroundDetail}
              onChange={(event) =>
                updateTerrain({
                  surroundDetail: event.target.value as TerrainSettings['surroundDetail'],
                })
              }
              disabled={isSavingScene || !sceneAppearance.terrain.surroundEnabled}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-40"
            >
              <option value="low">Low (48 segments)</option>
              <option value="medium">Medium (72 segments)</option>
            </select>
          </label>

          {(isSurroundLoading || isRefreshingSurround) && (
            <p className="text-xs text-cyan-300">Loading distant surround terrain…</p>
          )}

          {surroundError && <p className="text-xs text-red-300">{surroundError}</p>}

          <button
            type="button"
            onClick={() => void handleRefreshSurround()}
            disabled={
              isSavingScene ||
              isGeneratingTerrain ||
              isRefreshingSurround ||
              isSurroundLoading ||
              !sceneAppearance.terrain.surroundEnabled ||
              sceneAppearance.terrain.source !== 'dem'
            }
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
          >
            {isRefreshingSurround ? 'Refreshing surround…' : 'Refresh distant surround'}
          </button>

          {sceneAppearance.terrain.lastMinElevation !== null && sceneAppearance.terrain.lastMaxElevation !== null && (
            <p className="text-xs text-slate-400">
              Last fetch: {sceneAppearance.terrain.lastMinElevation.toFixed(1)}–
              {sceneAppearance.terrain.lastMaxElevation.toFixed(1)} m real elevation
              {sceneAppearance.terrain.lastZoom !== null ? ` · zoom ${sceneAppearance.terrain.lastZoom}` : ''}
            </p>
          )}

          {(isGeneratingTerrain || isHeightmapLoading) && (
            <p className="text-xs text-cyan-300">
              {heightmapProgress?.phase === 'tiles'
                ? 'Loading elevation tiles…'
                : heightmapProgress
                  ? `Sampling elevation (${Math.round(heightmapProgress.progress * 100)}%)…`
                  : 'Processing heightmap…'}
            </p>
          )}

          {heightmapError && <p className="text-xs text-red-300">{heightmapError}</p>}

          <button
            type="button"
            onClick={() => void handleFetchElevation()}
            disabled={
              isSavingScene ||
              isGeneratingTerrain ||
              isHeightmapLoading ||
              draftTerrainPolygon.length < 3 ||
              sceneAppearance.terrain.source === 'procedural'
            }
            className="rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            {isGeneratingTerrain ? 'Fetching elevation…' : 'Fetch elevation & apply'}
          </button>

          <hr className="border-slate-800" />

          <p className="text-xs text-slate-400">
            Terrain texture: satellite orthophoto or a simplified OpenStreetMap site plan (roads, buildings,
            trees). Uses the same outline as elevation.
          </p>

          <label className="block text-sm text-slate-300">
            Surface style
            <select
              value={sceneAppearance.terrain.surfaceStyle}
              onChange={(event) =>
                updateTerrain({ surfaceStyle: event.target.value as TerrainSettings['surfaceStyle'] })
              }
              disabled={isSavingScene || isGeneratingSurface || isSurfaceLoading}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-40"
            >
              {TERRAIN_SURFACE_STYLE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm text-slate-300">
            Surface texture resolution
            <select
              value={sceneAppearance.terrain.surfaceSampleSize}
              onChange={(event) =>
                updateTerrain({
                  surfaceSampleSize: Number(event.target.value) as TerrainSettings['surfaceSampleSize'],
                })
              }
              disabled={isSavingScene || isGeneratingSurface}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-40"
            >
              {TERRAIN_SURFACE_SAMPLE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}×{size} texture
                </option>
              ))}
            </select>
          </label>

          {sceneAppearance.terrain.surfaceStyle !== 'grid' && (
            <>
              <label className="block text-xs text-slate-400">
                Surface opacity ({Math.round(sceneAppearance.terrain.surfaceOpacity * 100)}%)
                <input
                  type="range"
                  min={20}
                  max={100}
                  value={Math.round(sceneAppearance.terrain.surfaceOpacity * 100)}
                  onChange={(event) =>
                    updateTerrain({ surfaceOpacity: Number(event.target.value) / 100 })
                  }
                  disabled={isSavingScene || isGeneratingSurface}
                  className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={sceneAppearance.terrain.showGridOverlay}
                  onChange={(event) => updateTerrain({ showGridOverlay: event.target.checked })}
                  disabled={isSavingScene || isGeneratingSurface}
                />
                Overlay placement grid
              </label>
            </>
          )}

          {sceneAppearance.terrain.surfaceVersion > 0 && sceneAppearance.terrain.surfaceStyle !== 'grid' && (
            <p className="text-xs text-slate-400">
              Applied surface v{sceneAppearance.terrain.surfaceVersion}
              {sceneAppearance.terrain.lastSurfaceZoom !== null
                ? ` · imagery zoom ${sceneAppearance.terrain.lastSurfaceZoom}`
                : ''}
            </p>
          )}

          {(isGeneratingSurface || isSurfaceLoading) && (
            <p className="text-xs text-cyan-300">
              {surfaceProgress?.phase === 'tiles'
                ? 'Loading satellite tiles…'
                : surfaceProgress?.phase === 'compositing'
                  ? `Compositing orthophoto (${Math.round(surfaceProgress.progress * 100)}%)…`
                  : surfaceProgress?.phase === 'fetch'
                    ? 'Fetching OpenStreetMap data…'
                    : surfaceProgress?.phase === 'render'
                      ? `Rendering site map (${Math.round(surfaceProgress.progress * 100)}%)…`
                      : 'Processing terrain surface…'}
            </p>
          )}

          {surfaceError && <p className="text-xs text-red-300">{surfaceError}</p>}

          <button
            type="button"
            onClick={() => void handleFetchSurface()}
            disabled={
              isSavingScene ||
              isGeneratingSurface ||
              isSurfaceLoading ||
              draftTerrainPolygon.length < 3 ||
              sceneAppearance.terrain.surfaceStyle === 'grid' ||
              sceneAppearance.terrain.source !== 'dem' ||
              sceneAppearance.terrain.version < 1
            }
            className="rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            {isGeneratingSurface ? 'Applying surface…' : 'Fetch & apply surface'}
          </button>

          <hr className="border-slate-800" />

          <p className="text-xs text-slate-400">
            3D map features from OpenStreetMap: extruded building footprints and instanced trees. Fetched once,
            cached locally, rendered with GPU instancing for performance.
          </p>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={sceneAppearance.terrain.osmFeaturesEnabled}
              onChange={(event) => updateTerrain({ osmFeaturesEnabled: event.target.checked })}
              disabled={isSavingScene || isGeneratingOsm}
            />
            Show OSM buildings & trees
          </label>

          {sceneAppearance.terrain.osmFeaturesVersion > 0 && (
            <p className="text-xs text-slate-400">OSM features v{sceneAppearance.terrain.osmFeaturesVersion}</p>
          )}

          {(isGeneratingOsm || isOsmFeaturesLoading) && (
            <p className="text-xs text-cyan-300">
              {osmFeaturesProgress !== null
                ? `Loading OSM features (${Math.round(osmFeaturesProgress * 100)}%)…`
                : 'Processing OSM features…'}
            </p>
          )}

          {osmFeaturesError && <p className="text-xs text-red-300">{osmFeaturesError}</p>}

          <button
            type="button"
            onClick={() => void handleFetchOsmFeatures()}
            disabled={
              isSavingScene ||
              isGeneratingOsm ||
              isOsmFeaturesLoading ||
              draftTerrainPolygon.length < 3 ||
              sceneAppearance.terrain.source === 'procedural'
            }
            className="rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            {isGeneratingOsm ? 'Fetching OSM features…' : 'Fetch OSM buildings & trees'}
          </button>

          <hr className="border-slate-800" />

          <p className="text-xs text-slate-400">
            Temporary layer alignment: offset and scale heightmap, orthophoto, and OSM layers. X = east–west,
            Y = north–south. Scale 1 = 100%.
          </p>

          <TerrainLayerNudgePanels
            layerNudges={sceneAppearance.terrain.layerNudges}
            disabled={isSavingScene}
            onUpdate={updateLayerNudge}
            onReset={resetLayerNudge}
          />

          <button
            type="button"
            onClick={resetLayerNudges}
            disabled={isSavingScene}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 disabled:opacity-40"
          >
            Reset all layer nudges
          </button>

          <button
            type="button"
            onClick={() => {
              resetTerrainDraft()
              applySceneAppearance(
                {
                  ...sceneAppearance,
                  terrain: DEFAULT_TERRAIN_SETTINGS,
                },
                { immediate: true },
              )
            }}
            disabled={isSavingScene || isGeneratingTerrain || isGeneratingSurface || isGeneratingOsm}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Reset terrain defaults
          </button>

          {terrainMessage && <p className="text-xs text-slate-400">{terrainMessage}</p>}
        </AdminSection>

        <AdminSection title="Fog" showVisibilityToggle={false} {...section('fog')}>
          <p className="text-xs text-slate-400">
            Linear distance fog fades terrain, props, and water into the horizon.
          </p>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={sceneAppearance.fog.enabled}
              onChange={(event) => updateFog({ enabled: event.target.checked })}
              disabled={isSavingScene}
            />
            Enable fog
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={sceneAppearance.fog.matchBackground}
              onChange={(event) => updateFog({ matchBackground: event.target.checked })}
              disabled={isSavingScene || !sceneAppearance.fog.enabled}
            />
            Match background color
          </label>

          {!sceneAppearance.fog.matchBackground && (
            <label className="block text-xs text-slate-400">
              Fog color
              <input
                type="color"
                value={sceneAppearance.fog.color}
                onChange={(event) => updateFog({ color: event.target.value })}
                disabled={isSavingScene || !sceneAppearance.fog.enabled}
                className="mt-1 h-9 w-full cursor-pointer rounded border border-slate-700 bg-slate-950 disabled:opacity-40"
              />
            </label>
          )}

          <label className="block text-xs text-slate-400">
            Near distance — fade starts ({Math.round(sceneAppearance.fog.near)} units)
            <input
              type="range"
              min={FOG_NEAR_MIN}
              max={FOG_NEAR_MAX}
              step={1}
              value={Math.round(sceneAppearance.fog.near)}
              onChange={(event) => updateFog({ near: Number(event.target.value) })}
              disabled={isSavingScene || !sceneAppearance.fog.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Far distance — fully faded ({Math.round(sceneAppearance.fog.far)} units)
            <input
              type="range"
              min={FOG_FAR_MIN}
              max={FOG_FAR_MAX}
              step={10}
              value={Math.min(FOG_FAR_MAX, Math.max(FOG_FAR_MIN, Math.round(sceneAppearance.fog.far)))}
              onChange={(event) => updateFog({ far: Number(event.target.value) })}
              disabled={isSavingScene || !sceneAppearance.fog.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <button
            type="button"
            onClick={resetFog}
            disabled={isSavingScene}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Reset fog defaults
          </button>
        </AdminSection>

        <AdminSection
          title="Water"
          showVisibilityToggle={false}
          {...section('water')}
        >
          <p className="text-xs text-slate-400">
            Animated sea surface at a configurable level. Syncs with scene settings on Supabase.
          </p>

          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={sceneAppearance.water.enabled}
              onChange={(event) => updateWater({ enabled: event.target.checked })}
              disabled={isSavingScene}
            />
            Show water
          </label>

          <label className="block text-sm text-slate-300">
            Water type
            <select
              value={sceneAppearance.water.style}
              onChange={(event) =>
                updateWater({ style: event.target.value as WaterSettings['style'] })
              }
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-40"
            >
              {WATER_STYLE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-slate-400">
            Sea plane size ({Math.round(sceneAppearance.water.planeSize)} units)
            <input
              type="range"
              min={50}
              max={2000}
              step={10}
              value={Math.round(sceneAppearance.water.planeSize)}
              onChange={(event) => updateWater({ planeSize: Number(event.target.value) })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Wave scale ({sceneAppearance.water.waveScale.toFixed(3)}× — higher = smaller ripples, world-space)
            <input
              type="range"
              min={Math.round(WATER_WAVE_SCALE_MIN * 1000)}
              max={Math.round(WATER_WAVE_SCALE_MAX * 1000)}
              step={1}
              value={Math.round(sceneAppearance.water.waveScale * 1000)}
              onChange={(event) => updateWater({ waveScale: Number(event.target.value) / 1000 })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
            <input
              type="number"
              min={WATER_WAVE_SCALE_MIN}
              max={WATER_WAVE_SCALE_MAX}
              step={0.001}
              value={sceneAppearance.water.waveScale}
              onChange={(event) => updateWater({ waveScale: Number(event.target.value) })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white disabled:opacity-40"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">
              Displacement distortion scale ({sceneAppearance.water.displacementDistortion.toFixed(3)})
              <input
                type="range"
                min={0}
                max={Math.round(WATER_DISTORTION_MAX * WATER_DISTORTION_SLIDER_SCALE)}
                step={1}
                value={Math.round(sceneAppearance.water.displacementDistortion * WATER_DISTORTION_SLIDER_SCALE)}
                onChange={(event) =>
                  updateWater({
                    displacementDistortion: Number(event.target.value) / WATER_DISTORTION_SLIDER_SCALE,
                  })
                }
                disabled={isSavingScene || !sceneAppearance.water.enabled}
                className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
              />
            </label>
            <label className="text-xs text-slate-400">
              Distortion speed ({sceneAppearance.water.displacementDistortionSpeed.toFixed(3)}×)
              <input
                type="range"
                min={0}
                max={Math.round(WATER_DISTORTION_SPEED_MAX * WATER_DISTORTION_SLIDER_SCALE)}
                step={1}
                value={Math.round(
                  sceneAppearance.water.displacementDistortionSpeed * WATER_DISTORTION_SLIDER_SCALE,
                )}
                onChange={(event) =>
                  updateWater({
                    displacementDistortionSpeed: Number(event.target.value) / WATER_DISTORTION_SLIDER_SCALE,
                  })
                }
                disabled={isSavingScene || !sceneAppearance.water.enabled}
                className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
              />
            </label>
          </div>

          <label className="block text-xs text-slate-400">
            Detail wave scale ({sceneAppearance.water.detailScale.toFixed(2)}×)
            <input
              type="range"
              min={Math.round(WATER_DETAIL_SCALE_MIN * 100)}
              max={Math.round(WATER_DETAIL_SCALE_MAX * 100)}
              step={1}
              value={Math.round(sceneAppearance.water.detailScale * 100)}
              onChange={(event) => updateWater({ detailScale: Number(event.target.value) / 100 })}
              disabled={
                isSavingScene || !sceneAppearance.water.enabled || sceneAppearance.water.detailLayers === 0
              }
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
            <input
              type="number"
              min={WATER_DETAIL_SCALE_MIN}
              max={WATER_DETAIL_SCALE_MAX}
              step={0.05}
              value={sceneAppearance.water.detailScale}
              onChange={(event) => updateWater({ detailScale: Number(event.target.value) })}
              disabled={
                isSavingScene || !sceneAppearance.water.enabled || sceneAppearance.water.detailLayers === 0
              }
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Radial edge fade ({Math.round(sceneAppearance.water.edgeFade * 100)}% — outer sea plane)
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(sceneAppearance.water.edgeFade * 100)}
              onChange={(event) => updateWater({ edgeFade: Number(event.target.value) / 100 })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Shoreline fade ({Math.round(sceneAppearance.water.shorelineFadeDistance)} m — distance from coast)
            <input
              type="range"
              min={0}
              max={WATER_SHORELINE_FADE_DISTANCE_MAX}
              step={1}
              value={Math.round(sceneAppearance.water.shorelineFadeDistance)}
              onChange={(event) =>
                updateWater({ shorelineFadeDistance: Number(event.target.value) })
              }
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Fade strength ({Math.round(sceneAppearance.water.shorelineFadeStrength * 100)}% — 0% off, 100% fully transparent at shore)
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(sceneAppearance.water.shorelineFadeStrength * 100)}
              onChange={(event) =>
                updateWater({ shorelineFadeStrength: Number(event.target.value) / 100 })
              }
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Sea level (Y)
            <input
              type="number"
              min={-2}
              max={8}
              step={0.05}
              value={sceneAppearance.water.level}
              onChange={(event) => updateWater({ level: Number(event.target.value) })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white disabled:opacity-40"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">
              Base colour
              <input
                type="color"
                value={sceneAppearance.water.color}
                onChange={(event) => updateWater({ color: event.target.value })}
                disabled={isSavingScene || !sceneAppearance.water.enabled}
                className="mt-1 h-9 w-full cursor-pointer rounded border border-slate-700 bg-slate-950 disabled:opacity-40"
              />
            </label>
            <label className="text-xs text-slate-400">
              Normal highlight colour
              <input
                type="color"
                value={sceneAppearance.water.normalHighlightColor}
                onChange={(event) => updateWater({ normalHighlightColor: event.target.value })}
                disabled={isSavingScene || !sceneAppearance.water.enabled}
                className="mt-1 h-9 w-full cursor-pointer rounded border border-slate-700 bg-slate-950 disabled:opacity-40"
              />
              <span className="mt-0.5 block text-[10px] text-slate-500">Lit side of wave normals</span>
            </label>
          </div>

          <label className="text-xs text-slate-400">
            Normal shadow colour
            <input
              type="color"
              value={sceneAppearance.water.normalShadowColor}
              onChange={(event) => updateWater({ normalShadowColor: event.target.value })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 h-9 w-full cursor-pointer rounded border border-slate-700 bg-slate-950 disabled:opacity-40"
            />
            <span className="mt-0.5 block text-[10px] text-slate-500">Dark side of wave normals</span>
          </label>

          <label className="block text-xs text-slate-400">
            Normal colour scale ({sceneAppearance.water.normalColorScale.toFixed(2)} — highlight and shadow tint intensity)
            <input
              type="range"
              min={0}
              max={Math.round(WATER_NORMAL_COLOR_SCALE_MAX * 100)}
              step={5}
              value={Math.round(sceneAppearance.water.normalColorScale * 100)}
              onChange={(event) => updateWater({ normalColorScale: Number(event.target.value) / 100 })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-sm text-slate-300">
            Mesh quality
            <select
              value={sceneAppearance.water.meshQuality}
              onChange={(event) =>
                updateWater({ meshQuality: event.target.value as WaterMeshQuality })
              }
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-40"
            >
              {WATER_MESH_QUALITY_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-slate-400">
            Wave seed ({Math.round(sceneAppearance.water.waveSeed)})
            <input
              type="range"
              min={0}
              max={999}
              value={Math.round(sceneAppearance.water.waveSeed)}
              onChange={(event) => updateWater({ waveSeed: Number(event.target.value) })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-sm text-slate-300">
            Detail layers
            <select
              value={sceneAppearance.water.detailLayers}
              onChange={(event) =>
                updateWater({ detailLayers: Number(event.target.value) as WaterSettings['detailLayers'] })
              }
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-40"
            >
              {WATER_DETAIL_LAYER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-slate-400">
            Detail strength ({Math.round(sceneAppearance.water.detailStrength * 100)}%)
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(sceneAppearance.water.detailStrength * 100)}
              onChange={(event) => updateWater({ detailStrength: Number(event.target.value) / 100 })}
              disabled={
                isSavingScene || !sceneAppearance.water.enabled || sceneAppearance.water.detailLayers === 0
              }
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">
              Detail distortion scale ({sceneAppearance.water.detailDistortion.toFixed(3)})
              <input
                type="range"
                min={0}
                max={Math.round(WATER_DISTORTION_MAX * WATER_DISTORTION_SLIDER_SCALE)}
                step={1}
                value={Math.round(sceneAppearance.water.detailDistortion * WATER_DISTORTION_SLIDER_SCALE)}
                onChange={(event) =>
                  updateWater({ detailDistortion: Number(event.target.value) / WATER_DISTORTION_SLIDER_SCALE })
                }
                disabled={
                  isSavingScene || !sceneAppearance.water.enabled || sceneAppearance.water.detailLayers === 0
                }
                className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
              />
            </label>
            <label className="text-xs text-slate-400">
              Distortion speed ({sceneAppearance.water.detailDistortionSpeed.toFixed(3)}×)
              <input
                type="range"
                min={0}
                max={Math.round(WATER_DISTORTION_SPEED_MAX * WATER_DISTORTION_SLIDER_SCALE)}
                step={1}
                value={Math.round(sceneAppearance.water.detailDistortionSpeed * WATER_DISTORTION_SLIDER_SCALE)}
                onChange={(event) =>
                  updateWater({
                    detailDistortionSpeed: Number(event.target.value) / WATER_DISTORTION_SLIDER_SCALE,
                  })
                }
                disabled={
                  isSavingScene || !sceneAppearance.water.enabled || sceneAppearance.water.detailLayers === 0
                }
                className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
              />
            </label>
          </div>

          <label className="block text-xs text-slate-400">
            Wave height ({sceneAppearance.water.waveHeight.toFixed(2)})
            <input
              type="range"
              min={0}
              max={200}
              value={Math.round(sceneAppearance.water.waveHeight * 100)}
              onChange={(event) => updateWater({ waveHeight: Number(event.target.value) / 100 })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Wave intensity ({sceneAppearance.water.waveIntensity.toFixed(2)})
            <input
              type="range"
              min={0}
              max={400}
              value={Math.round(sceneAppearance.water.waveIntensity * 100)}
              onChange={(event) => updateWater({ waveIntensity: Number(event.target.value) / 100 })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Animation speed ({sceneAppearance.water.animationSpeed.toFixed(2)}×)
            <input
              type="range"
              min={0}
              max={500}
              value={Math.round(sceneAppearance.water.animationSpeed * 100)}
              onChange={(event) => updateWater({ animationSpeed: Number(event.target.value) / 100 })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Opacity ({Math.round(sceneAppearance.water.opacity * 100)}%)
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(sceneAppearance.water.opacity * 100)}
              onChange={(event) => updateWater({ opacity: Number(event.target.value) / 100 })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-400">
              Metalness ({Math.round(sceneAppearance.water.metalness * 100)}%)
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(sceneAppearance.water.metalness * 100)}
                onChange={(event) => updateWater({ metalness: Number(event.target.value) / 100 })}
                disabled={isSavingScene || !sceneAppearance.water.enabled}
                className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
              />
            </label>
            <label className="text-xs text-slate-400">
              Roughness ({Math.round(sceneAppearance.water.roughness * 100)}%)
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(sceneAppearance.water.roughness * 100)}
                onChange={(event) => updateWater({ roughness: Number(event.target.value) / 100 })}
                disabled={isSavingScene || !sceneAppearance.water.enabled}
                className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
              />
            </label>
          </div>

          <p className="text-xs text-slate-400">
            Displacement comes from the mesh. Base and detail normal layers adjust lighting only (not geometry).
          </p>

          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <p className="text-xs font-medium text-slate-300">Base normal map</p>

            <label className="block text-xs text-slate-400">
              Shape
              <select
                value={sceneAppearance.water.baseNormalMap.shape}
                onChange={(event) =>
                  updateBaseNormalMap({ shape: event.target.value as WaterSettings['style'] })
                }
                disabled={isSavingScene || !sceneAppearance.water.enabled}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-40"
              >
                {WATER_STYLE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-xs text-slate-400">
              Ripple scale ({sceneAppearance.water.baseNormalMap.waveScale.toFixed(2)}× — higher = finer ripples)
              <input
                type="range"
                min={Math.round(WATER_NORMAL_MAP_WAVE_SCALE_MIN * 1000)}
                max={Math.round(WATER_NORMAL_MAP_WAVE_SCALE_MAX * 1000)}
                step={1}
                value={Math.round(sceneAppearance.water.baseNormalMap.waveScale * 1000)}
                onChange={(event) =>
                  updateBaseNormalMap({ waveScale: Number(event.target.value) / 1000 })
                }
                disabled={isSavingScene || !sceneAppearance.water.enabled}
                className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">
                Stretch X ({sceneAppearance.water.baseNormalMap.stretchX.toFixed(2)}×)
                <input
                  type="range"
                  min={Math.round(WATER_NORMAL_LAYER_STRETCH_MIN * 100)}
                  max={Math.round(WATER_NORMAL_LAYER_STRETCH_MAX * 100)}
                  step={5}
                  value={Math.round(sceneAppearance.water.baseNormalMap.stretchX * 100)}
                  onChange={(event) =>
                    updateBaseNormalMap({ stretchX: Number(event.target.value) / 100 })
                  }
                  disabled={isSavingScene || !sceneAppearance.water.enabled}
                  className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                />
              </label>
              <label className="text-xs text-slate-400">
                Stretch Z ({sceneAppearance.water.baseNormalMap.stretchZ.toFixed(2)}×)
                <input
                  type="range"
                  min={Math.round(WATER_NORMAL_LAYER_STRETCH_MIN * 100)}
                  max={Math.round(WATER_NORMAL_LAYER_STRETCH_MAX * 100)}
                  step={5}
                  value={Math.round(sceneAppearance.water.baseNormalMap.stretchZ * 100)}
                  onChange={(event) =>
                    updateBaseNormalMap({ stretchZ: Number(event.target.value) / 100 })
                  }
                  disabled={isSavingScene || !sceneAppearance.water.enabled}
                  className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                />
              </label>
            </div>

            <label className="block text-xs text-slate-400">
              Layer strength ({Math.round(sceneAppearance.water.baseNormalMap.strength * 100)}%)
              <input
                type="range"
                min={0}
                max={Math.round(WATER_NORMAL_LAYER_STRENGTH_MAX * 100)}
                step={1}
                value={Math.round(sceneAppearance.water.baseNormalMap.strength * 100)}
                onChange={(event) =>
                  updateBaseNormalMap({ strength: Number(event.target.value) / 100 })
                }
                disabled={isSavingScene || !sceneAppearance.water.enabled}
                className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
              />
            </label>

            <label className="block text-xs text-slate-400">
              Animation ({sceneAppearance.water.baseNormalMap.speed.toFixed(2)}× — 0 = frozen)
              <input
                type="range"
                min={0}
                max={Math.round(WATER_NORMAL_MAP_SPEED_MAX * 100)}
                step={5}
                value={Math.round(sceneAppearance.water.baseNormalMap.speed * 100)}
                onChange={(event) =>
                  updateBaseNormalMap({ speed: Number(event.target.value) / 100 })
                }
                disabled={isSavingScene || !sceneAppearance.water.enabled}
                className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">
                Distortion scale ({sceneAppearance.water.baseNormalMap.distortion.toFixed(3)})
                <input
                  type="range"
                  min={0}
                  max={Math.round(WATER_DISTORTION_MAX * WATER_DISTORTION_SLIDER_SCALE)}
                  step={1}
                  value={Math.round(
                    sceneAppearance.water.baseNormalMap.distortion * WATER_DISTORTION_SLIDER_SCALE,
                  )}
                  onChange={(event) =>
                    updateBaseNormalMap({ distortion: Number(event.target.value) / WATER_DISTORTION_SLIDER_SCALE })
                  }
                  disabled={isSavingScene || !sceneAppearance.water.enabled}
                  className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                />
              </label>
              <label className="text-xs text-slate-400">
                Distortion speed ({sceneAppearance.water.baseNormalMap.distortionSpeed.toFixed(3)}×)
                <input
                  type="range"
                  min={0}
                  max={Math.round(WATER_DISTORTION_SPEED_MAX * WATER_DISTORTION_SLIDER_SCALE)}
                  step={1}
                  value={Math.round(
                    sceneAppearance.water.baseNormalMap.distortionSpeed * WATER_DISTORTION_SLIDER_SCALE,
                  )}
                  onChange={(event) =>
                    updateBaseNormalMap({
                      distortionSpeed: Number(event.target.value) / WATER_DISTORTION_SLIDER_SCALE,
                    })
                  }
                  disabled={isSavingScene || !sceneAppearance.water.enabled}
                  className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                />
              </label>
            </div>
          </div>

          <label className="block text-xs text-slate-400">
            Wave surface normals ({Math.round(sceneAppearance.water.normalMapStrength * 100)}% — 0% flat mirror, 100% full wave lighting)
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(sceneAppearance.water.normalMapStrength * 100)}
              onChange={(event) => updateWater({ normalMapStrength: Number(event.target.value) / 100 })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
          </label>

          <label className="block text-xs text-slate-400">
            Normal layers
            <select
              value={sceneAppearance.water.normalLayers}
              onChange={(event) =>
                updateWater({ normalLayers: Number(event.target.value) as WaterSettings['normalLayers'] })
              }
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white disabled:opacity-40"
            >
              {WATER_NORMAL_LAYER_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {sceneAppearance.water.normalLayers > 0 &&
            sceneAppearance.water.normalLayerSettings
              .slice(0, sceneAppearance.water.normalLayers)
              .map((layer, index) => (
                <div
                  key={index}
                  className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                >
                  <p className="text-xs font-medium text-slate-300">Normal layer {index + 1}</p>

                  <label className="block text-xs text-slate-400">
                    Ripple scale ({layer.waveScale.toFixed(2)}× — higher = finer ripples)
                    <input
                      type="range"
                      min={Math.round(WATER_NORMAL_MAP_WAVE_SCALE_MIN * 1000)}
                      max={Math.round(WATER_NORMAL_MAP_WAVE_SCALE_MAX * 1000)}
                      step={1}
                      value={Math.round(layer.waveScale * 1000)}
                      onChange={(event) =>
                        updateNormalLayer(index, { waveScale: Number(event.target.value) / 1000 })
                      }
                      disabled={isSavingScene || !sceneAppearance.water.enabled}
                      className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-slate-400">
                      Stretch X ({layer.stretchX.toFixed(2)}×)
                      <input
                        type="range"
                        min={Math.round(WATER_NORMAL_LAYER_STRETCH_MIN * 100)}
                        max={Math.round(WATER_NORMAL_LAYER_STRETCH_MAX * 100)}
                        step={5}
                        value={Math.round(layer.stretchX * 100)}
                        onChange={(event) =>
                          updateNormalLayer(index, { stretchX: Number(event.target.value) / 100 })
                        }
                        disabled={isSavingScene || !sceneAppearance.water.enabled}
                        className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Stretch Z ({layer.stretchZ.toFixed(2)}×)
                      <input
                        type="range"
                        min={Math.round(WATER_NORMAL_LAYER_STRETCH_MIN * 100)}
                        max={Math.round(WATER_NORMAL_LAYER_STRETCH_MAX * 100)}
                        step={5}
                        value={Math.round(layer.stretchZ * 100)}
                        onChange={(event) =>
                          updateNormalLayer(index, { stretchZ: Number(event.target.value) / 100 })
                        }
                        disabled={isSavingScene || !sceneAppearance.water.enabled}
                        className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                      />
                    </label>
                  </div>

                  <label className="block text-xs text-slate-400">
                    Layer strength ({Math.round(layer.strength * 100)}%)
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(layer.strength * 100)}
                      onChange={(event) =>
                        updateNormalLayer(index, { strength: Number(event.target.value) / 100 })
                      }
                      disabled={isSavingScene || !sceneAppearance.water.enabled}
                      className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                    />
                  </label>

                  <label className="block text-xs text-slate-400">
                    Animation ({layer.speed.toFixed(2)}× — 0 = frozen for this layer)
                    <input
                      type="range"
                      min={0}
                      max={Math.round(WATER_NORMAL_MAP_SPEED_MAX * 100)}
                      step={5}
                      value={Math.round(layer.speed * 100)}
                      onChange={(event) =>
                        updateNormalLayer(index, { speed: Number(event.target.value) / 100 })
                      }
                      disabled={isSavingScene || !sceneAppearance.water.enabled}
                      className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-slate-400">
                      Distortion scale ({layer.distortion.toFixed(3)})
                      <input
                        type="range"
                        min={0}
                        max={Math.round(WATER_DISTORTION_MAX * WATER_DISTORTION_SLIDER_SCALE)}
                        step={1}
                        value={Math.round(layer.distortion * WATER_DISTORTION_SLIDER_SCALE)}
                        onChange={(event) =>
                          updateNormalLayer(index, {
                            distortion: Number(event.target.value) / WATER_DISTORTION_SLIDER_SCALE,
                          })
                        }
                        disabled={isSavingScene || !sceneAppearance.water.enabled}
                        className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                      />
                    </label>
                    <label className="text-xs text-slate-400">
                      Distortion speed ({layer.distortionSpeed.toFixed(3)}×)
                      <input
                        type="range"
                        min={0}
                        max={Math.round(WATER_DISTORTION_SPEED_MAX * WATER_DISTORTION_SLIDER_SCALE)}
                        step={1}
                        value={Math.round(layer.distortionSpeed * WATER_DISTORTION_SLIDER_SCALE)}
                        onChange={(event) =>
                          updateNormalLayer(index, {
                            distortionSpeed: Number(event.target.value) / WATER_DISTORTION_SLIDER_SCALE,
                          })
                        }
                        disabled={isSavingScene || !sceneAppearance.water.enabled}
                        className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                      />
                    </label>
                  </div>
                </div>
              ))}

          <label className="block text-xs text-slate-400">
            Normal sample size ({sceneAppearance.water.normalMapScale.toFixed(2)} m — higher = softer displacement normals)
            <input
              type="range"
              min={Math.round(WATER_NORMAL_MAP_SCALE_MIN * 100)}
              max={Math.round(WATER_NORMAL_MAP_SCALE_MAX * 100)}
              step={5}
              value={Math.round(sceneAppearance.water.normalMapScale * 100)}
              onChange={(event) => updateWater({ normalMapScale: Number(event.target.value) / 100 })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
            />
            <input
              type="number"
              min={WATER_NORMAL_MAP_SCALE_MIN}
              max={WATER_NORMAL_MAP_SCALE_MAX}
              step={0.05}
              value={sceneAppearance.water.normalMapScale}
              onChange={(event) => updateWater({ normalMapScale: Number(event.target.value) })}
              disabled={isSavingScene || !sceneAppearance.water.enabled}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white disabled:opacity-40"
            />
          </label>

          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-slate-300">Terrain edge ripples</p>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={sceneAppearance.water.edgeRipples.enabled}
                  onChange={(event) => updateEdgeRipples({ enabled: event.target.checked })}
                  disabled={isSavingScene || !sceneAppearance.water.enabled}
                  className="accent-cyan-500 disabled:opacity-40"
                />
                Enabled
              </label>
            </div>
            <p className="text-xs text-slate-500">
              Concentric ripples moving outward from where the sea plane intersects the terrain surface.
            </p>

            <label className="block text-xs text-slate-400">
              Ripple strength ({Math.round(sceneAppearance.water.edgeRipples.strength * 100)}%)
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(sceneAppearance.water.edgeRipples.strength * 100)}
                onChange={(event) =>
                  updateEdgeRipples({ strength: Number(event.target.value) / 100 })
                }
                disabled={
                  isSavingScene ||
                  !sceneAppearance.water.enabled ||
                  !sceneAppearance.water.edgeRipples.enabled
                }
                className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
              />
            </label>

            <label className="block text-xs text-slate-400">
              Propagation speed ({sceneAppearance.water.edgeRipples.speed.toFixed(2)}×)
              <input
                type="range"
                min={0}
                max={Math.round(WATER_EDGE_RIPPLE_SPEED_MAX * 100)}
                step={5}
                value={Math.round(sceneAppearance.water.edgeRipples.speed * 100)}
                onChange={(event) =>
                  updateEdgeRipples({ speed: Number(event.target.value) / 100 })
                }
                disabled={
                  isSavingScene ||
                  !sceneAppearance.water.enabled ||
                  !sceneAppearance.water.edgeRipples.enabled
                }
                className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
              />
            </label>

            <label className="block text-xs text-slate-400">
              Ring frequency ({sceneAppearance.water.edgeRipples.waveScale.toFixed(2)}× — higher = tighter rings)
              <input
                type="range"
                min={Math.round(WATER_EDGE_RIPPLE_WAVE_SCALE_MIN * 100)}
                max={Math.round(WATER_EDGE_RIPPLE_WAVE_SCALE_MAX * 100)}
                step={1}
                value={Math.round(sceneAppearance.water.edgeRipples.waveScale * 100)}
                onChange={(event) =>
                  updateEdgeRipples({ waveScale: Number(event.target.value) / 100 })
                }
                disabled={
                  isSavingScene ||
                  !sceneAppearance.water.enabled ||
                  !sceneAppearance.water.edgeRipples.enabled
                }
                className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">
                Falloff ({sceneAppearance.water.edgeRipples.falloff.toFixed(3)})
                <input
                  type="range"
                  min={0}
                  max={Math.round(WATER_EDGE_RIPPLE_FALLOFF_MAX * 1000)}
                  step={1}
                  value={Math.round(sceneAppearance.water.edgeRipples.falloff * 1000)}
                  onChange={(event) =>
                    updateEdgeRipples({ falloff: Number(event.target.value) / 1000 })
                  }
                  disabled={
                    isSavingScene ||
                    !sceneAppearance.water.enabled ||
                    !sceneAppearance.water.edgeRipples.enabled
                  }
                  className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                />
              </label>
              <label className="text-xs text-slate-400">
                Max distance ({Math.round(sceneAppearance.water.edgeRipples.maxDistance)} m)
                <input
                  type="range"
                  min={10}
                  max={WATER_EDGE_RIPPLE_MAX_DISTANCE_MAX}
                  step={5}
                  value={Math.round(sceneAppearance.water.edgeRipples.maxDistance)}
                  onChange={(event) =>
                    updateEdgeRipples({ maxDistance: Number(event.target.value) })
                  }
                  disabled={
                    isSavingScene ||
                    !sceneAppearance.water.enabled ||
                    !sceneAppearance.water.edgeRipples.enabled
                  }
                  className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">
                Displacement ({Math.round(sceneAppearance.water.edgeRipples.displacementStrength * 100)}%)
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(sceneAppearance.water.edgeRipples.displacementStrength * 100)}
                  onChange={(event) =>
                    updateEdgeRipples({ displacementStrength: Number(event.target.value) / 100 })
                  }
                  disabled={
                    isSavingScene ||
                    !sceneAppearance.water.enabled ||
                    !sceneAppearance.water.edgeRipples.enabled
                  }
                  className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                />
              </label>
              <label className="text-xs text-slate-400">
                Normal lighting ({Math.round(sceneAppearance.water.edgeRipples.normalStrength * 100)}%)
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(sceneAppearance.water.edgeRipples.normalStrength * 100)}
                  onChange={(event) =>
                    updateEdgeRipples({ normalStrength: Number(event.target.value) / 100 })
                  }
                  disabled={
                    isSavingScene ||
                    !sceneAppearance.water.enabled ||
                    !sceneAppearance.water.edgeRipples.enabled
                  }
                  className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                />
              </label>
              <label className="block text-xs text-slate-400">
                Peak / trough softness ({Math.round(sceneAppearance.water.edgeRipples.softness * 100)}% — rounds ripple crests)
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(sceneAppearance.water.edgeRipples.softness * 100)}
                  onChange={(event) =>
                    updateEdgeRipples({ softness: Number(event.target.value) / 100 })
                  }
                  disabled={
                    isSavingScene ||
                    !sceneAppearance.water.enabled ||
                    !sceneAppearance.water.edgeRipples.enabled
                  }
                  className="mt-1 w-full accent-cyan-500 disabled:opacity-40"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveWaterDefaults}
              disabled={isSavingScene}
              className="rounded-lg bg-cyan-800/80 px-3 py-2 text-sm text-white hover:bg-cyan-700 disabled:opacity-40"
            >
              Save current as defaults
            </button>
            <button
              type="button"
              onClick={resetWater}
              disabled={isSavingScene}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              Reset water defaults
            </button>
          </div>
        </AdminSection>

        <AdminSection
          title="History Controls"
          visible={settings.userVisibility.showUndoRedo}
          onToggleVisibility={() =>
            updateVisibility({ showUndoRedo: !settings.userVisibility.showUndoRedo })
          }
          {...section('historyControls')}
        >
          <div className="flex gap-2">
            <button type="button" disabled={!canUndo} onClick={undo} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40">
              Undo
            </button>
            <button type="button" disabled={!canRedo} onClick={redo} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40">
              Redo
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Undoes prop placements, edits, and terrain sculpt strokes. Admin panel setting changes are not included.
          </p>
        </AdminSection>

        <AdminSection
          title="Map Operations"
          visible={settings.userVisibility.showPlacementHints}
          onToggleVisibility={() =>
            updateVisibility({ showPlacementHints: !settings.userVisibility.showPlacementHints })
          }
          {...section('mapOperations')}
        >
          <p className="mb-3 text-xs text-slate-400">
            Admin actions bypass rate limits and apply to the shared multiplayer map.
          </p>
          {isLayoutLocked && (
            <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-950/40 px-2 py-1.5 text-xs text-amber-200">
              Layout is locked — visitors cannot place or edit props.
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={isMapOpRunning || sceneAppearance.terrain.sculptVersion === 0}
              onClick={() => void handleResetSculpting()}
              className="rounded-lg bg-orange-700/90 px-3 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-40"
            >
              Reset Terrain Sculpting
            </button>
            <button
              type="button"
              disabled={isMapOpRunning || !isMultiplayer}
              onClick={() => void handleWipeMap()}
              className="rounded-lg bg-red-600/90 px-3 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-40"
            >
              Wipe Map Clutter
            </button>
            <button
              type="button"
              disabled={isMapOpRunning || placedProps.length === 0}
              onClick={() => void handleDeleteAllProps()}
              className="rounded-lg bg-red-800/90 px-3 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-40"
            >
              Delete All Props
            </button>
            <button
              type="button"
              disabled={isMapOpRunning || !isMultiplayer || isLayoutLocked}
              onClick={() => void handleLockLayout()}
              className="rounded-lg bg-amber-600/90 px-3 py-2 text-sm text-white hover:bg-amber-500 disabled:opacity-40"
            >
              Lock Current Layout
            </button>
            <button
              type="button"
              disabled={isMapOpRunning || !isMultiplayer || !isLayoutLocked}
              onClick={() => void handleUnlockLayout()}
              className="rounded-lg bg-emerald-600/90 px-3 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              Unlock Current Layout
            </button>
          </div>
          {!isMultiplayer && (
            <p className="mt-2 text-xs text-slate-500">
              Connect Supabase for clutter wipe and layout lock. Delete all props also works locally.
            </p>
          )}
          {mapOpMessage && <p className="mt-2 text-xs text-slate-400">{mapOpMessage}</p>}
        </AdminSection>

        <AdminSection
          title="Placement Rules"
          visible={settings.userVisibility.showPlacementHints}
          onToggleVisibility={() =>
            updateVisibility({ showPlacementHints: !settings.userVisibility.showPlacementHints })
          }
          {...section('placementRules')}
        >
          <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.placementRules.snapGridEnabled}
              onChange={(event) => updateRules({ snapGridEnabled: event.target.checked })}
            />
            Snap to grid
          </label>
          <label className="mb-2 block text-sm text-slate-300">
            Grid size
            <input
              type="number"
              min={1}
              max={50}
              value={settings.placementRules.snapGridSize}
              onChange={(event) => updateRules({ snapGridSize: Number(event.target.value) || 5 })}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            />
          </label>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-300">Show snap grid to users</span>
            <VisibilityToggle
              visible={settings.userVisibility.showSnapGrid}
              onToggle={() => updateVisibility({ showSnapGrid: !settings.userVisibility.showSnapGrid })}
            />
          </div>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-slate-300">Show excavate / fill tools</span>
            <VisibilityToggle
              visible={settings.userVisibility.showSculptTools}
              onToggle={() =>
                updateVisibility({ showSculptTools: !settings.userVisibility.showSculptTools })
              }
            />
          </div>

          <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.placementRules.densityEnabled}
              onChange={(event) => updateRules({ densityEnabled: event.target.checked })}
            />
            Max prop density
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Cell size
              <input
                type="number"
                min={2}
                value={settings.placementRules.densityCellSize}
                onChange={(event) =>
                  updateRules({ densityCellSize: Number(event.target.value) || 10 })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
            </label>
            <label className="text-xs text-slate-400">
              Max / cell
              <input
                type="number"
                min={1}
                value={settings.placementRules.maxPropsPerCell}
                onChange={(event) =>
                  updateRules({ maxPropsPerCell: Number(event.target.value) || 3 })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
            </label>
          </div>
        </AdminSection>

        <AdminSection
          title="Rate Limits"
          visible={settings.userVisibility.showPlacementHints}
          onToggleVisibility={() =>
            updateVisibility({ showPlacementHints: !settings.userVisibility.showPlacementHints })
          }
          {...section('rateLimits')}
        >
          {isAdminSession && isMultiplayer && (
            <p className="mb-3 rounded-md border border-emerald-500/30 bg-emerald-950/40 px-2 py-1.5 text-xs text-emerald-200">
              Admin session active — rate limits bypassed for you.
            </p>
          )}

          <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.rateLimit.enabled}
              onChange={(event) => updateRateLimit({ enabled: event.target.checked })}
            />
            Enable placement rate limits
          </label>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Default max placements
              <input
                type="number"
                min={1}
                value={settings.rateLimit.maxPlacements}
                onChange={(event) =>
                  updateRateLimit({ maxPlacements: Number(event.target.value) || 1 })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
            </label>
            <label className="text-xs text-slate-400">
              Default window (minutes)
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={settings.rateLimit.windowMinutes}
                onChange={(event) =>
                  updateRateLimit({ windowMinutes: Number(event.target.value) || 1 })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
            </label>
          </div>

          <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
            Terrain sculpt (excavate / fill)
          </p>

          <label className="mb-2 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.rateLimit.terrainSculpt.enabled}
              onChange={(event) =>
                updateRateLimit({
                  terrainSculpt: {
                    ...settings.rateLimit.terrainSculpt,
                    enabled: event.target.checked,
                  },
                })
              }
            />
            Enable terrain sculpt rate limits
          </label>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-400">
              Max sculpt strokes
              <input
                type="number"
                min={1}
                value={settings.rateLimit.terrainSculpt.maxStrokes}
                onChange={(event) =>
                  updateRateLimit({
                    terrainSculpt: {
                      ...settings.rateLimit.terrainSculpt,
                      maxStrokes: Number(event.target.value) || 1,
                    },
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
            </label>
            <label className="text-xs text-slate-400">
              Sculpt window (minutes)
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={settings.rateLimit.terrainSculpt.windowMinutes}
                onChange={(event) =>
                  updateRateLimit({
                    terrainSculpt: {
                      ...settings.rateLimit.terrainSculpt,
                      windowMinutes: Number(event.target.value) || 1,
                    },
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              />
            </label>
          </div>

          <p className="mb-2 text-xs text-slate-500">
            Per-prop overrides (placements per minute). Leave disabled to use defaults.
          </p>
          <div className="mb-3 max-h-48 space-y-2 overflow-y-auto">
            {settings.propLibrary
              .filter((prop) => prop.userPlaceable)
              .map((prop) => {
                const limit = getPropRateLimit(settings.rateLimit, prop.id)
                const perProp = settings.rateLimit.perProp[prop.id]
                return (
                  <div key={prop.id} className="rounded-md border border-slate-800/80 p-2">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                      <span>{prop.name}</span>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={perProp?.enabled ?? false}
                          onChange={(event) =>
                            updatePropRateLimit(prop.id, {
                              enabled: event.target.checked,
                              maxPlacements: limit.maxPlacements,
                              windowMinutes: limit.windowMinutes,
                            })
                          }
                        />
                        Custom limit
                      </label>
                    </div>
                    {(perProp?.enabled ?? false) && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[11px] text-slate-400">
                          Max / window
                          <input
                            type="number"
                            min={1}
                            value={perProp?.maxPlacements ?? limit.maxPlacements}
                            onChange={(event) =>
                              updatePropRateLimit(prop.id, {
                                maxPlacements: Number(event.target.value) || 1,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                          />
                        </label>
                        <label className="text-[11px] text-slate-400">
                          Window (min)
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={perProp?.windowMinutes ?? limit.windowMinutes}
                            onChange={(event) =>
                              updatePropRateLimit(prop.id, {
                                windowMinutes: Number(event.target.value) || 1,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}
          </div>

          <button
            type="button"
            disabled={isSavingRateLimits}
            onClick={() => void handleSaveRateLimits()}
            className="rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            {isSavingRateLimits ? 'Applying…' : 'Apply rate limits to server'}
          </button>
          {rateLimitMessage && (
            <p className="mt-2 text-xs text-slate-400">{rateLimitMessage}</p>
          )}
        </AdminSection>

        <AdminSection
          title="Allowed Zones"
          visible={settings.userVisibility.showZoneOverlays}
          onToggleVisibility={() =>
            updateVisibility({ showZoneOverlays: !settings.userVisibility.showZoneOverlays })
          }
          {...section('allowedZones')}
        >
          <label className="mb-3 flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={settings.placementRules.zonesEnabled}
              onChange={(event) => updateRules({ zonesEnabled: event.target.checked })}
            />
            Restrict placement to zones
          </label>
          <div className="mb-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setZoneDrawingMode(!zoneDrawingMode)}
              className={`rounded-lg px-3 py-2 text-sm ${
                zoneDrawingMode ? 'bg-amber-500 text-black' : 'bg-slate-800 text-white'
              }`}
            >
              {zoneDrawingMode ? 'Drawing… click terrain' : 'Draw zone'}
            </button>
            <button type="button" onClick={clearDraftZone} className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white">
              Clear draft
            </button>
          </div>
          <p className="mb-2 text-xs text-slate-400">{draftZonePoints.length} draft points (min 3)</p>
          <input
            value={zoneName}
            onChange={(event) => setZoneName(event.target.value)}
            className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            disabled={draftZonePoints.length < 3}
            onClick={() => finishDraftZone(zoneName)}
            className="rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Finish zone
          </button>
          <ul className="mt-3 space-y-1 text-xs text-slate-400">
            {settings.zones.map((zone) => (
              <li key={zone.id}>
                {zone.name} · {zone.points.length} pts
              </li>
            ))}
          </ul>
        </AdminSection>

        <AdminSection
          title="Prop Library"
          visible={settings.userVisibility.showPropToolbar}
          onToggleVisibility={() =>
            updateVisibility({ showPropToolbar: !settings.userVisibility.showPropToolbar })
          }
          {...section('propLibrary')}
        >
          <div className="space-y-3">
            {settings.categories.map((category) => (
              <div key={category.id} className="rounded-lg border border-slate-800 p-2">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{category.name}</p>
                    <p className="text-xs text-slate-500">{category.description}</p>
                  </div>
                  <VisibilityToggle
                    visible={category.userVisible}
                    onToggle={() => toggleCategoryVisibility(category.id)}
                  />
                </div>
                <ul className="space-y-3">
                  {settings.propLibrary
                    .filter((prop) => prop.categoryId === category.id)
                    .map((prop) => (
                      <li key={prop.id} className="rounded-md border border-slate-800/80 p-2">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                          <span>
                            {prop.name}{' '}
                            <span className="text-slate-500">({prop.behavior})</span>
                          </span>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={prop.userPlaceable}
                              onChange={() => togglePropPlaceable(prop.id)}
                            />
                            Users
                          </label>
                        </div>

                        <label className="mb-2 block text-xs text-slate-400">
                          Collider radius
                          <input
                            type="number"
                            min={0.1}
                            step={0.1}
                            value={prop.placement.colliderRadius}
                            onChange={(event) =>
                              updatePropPlacement(prop.id, {
                                colliderRadius: Number(event.target.value) || 0.1,
                              })
                            }
                            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                          />
                        </label>

                        <label className="mb-2 flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={prop.variation.enabled}
                            onChange={(event) =>
                              updatePropVariation(prop.id, { enabled: event.target.checked })
                            }
                          />
                          Randomize color &amp; scale on place
                        </label>
                        {prop.variation.enabled && (
                          <div className="mb-2 grid grid-cols-2 gap-2">
                            <label className="text-[11px] text-slate-400">
                              Scale min
                              <input
                                type="number"
                                min={0.25}
                                step={0.05}
                                value={prop.variation.scaleMin}
                                onChange={(event) =>
                                  updatePropVariation(prop.id, {
                                    scaleMin: Number(event.target.value) || 0.25,
                                  })
                                }
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                              />
                            </label>
                            <label className="text-[11px] text-slate-400">
                              Scale max
                              <input
                                type="number"
                                min={0.25}
                                step={0.05}
                                value={prop.variation.scaleMax}
                                onChange={(event) =>
                                  updatePropVariation(prop.id, {
                                    scaleMax: Number(event.target.value) || 0.25,
                                  })
                                }
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                              />
                            </label>
                            <label className="text-[11px] text-slate-400">
                              Color min
                              <input
                                type="color"
                                value={prop.variation.colorMin}
                                onChange={(event) =>
                                  updatePropVariation(prop.id, { colorMin: event.target.value })
                                }
                                className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-950"
                              />
                            </label>
                            <label className="text-[11px] text-slate-400">
                              Color max
                              <input
                                type="color"
                                value={prop.variation.colorMax}
                                onChange={(event) =>
                                  updatePropVariation(prop.id, { colorMax: event.target.value })
                                }
                                className="mt-1 h-8 w-full cursor-pointer rounded border border-slate-700 bg-slate-950"
                              />
                            </label>
                          </div>
                        )}

                        <label className="mb-2 flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={prop.placement.useCustomZones}
                            onChange={(event) =>
                              updatePropPlacement(prop.id, { useCustomZones: event.target.checked })
                            }
                          />
                          Custom zone rules
                        </label>
                        {prop.placement.useCustomZones && (
                          <div className="mb-2 space-y-1">
                            {settings.zones.length === 0 && (
                              <p className="text-[11px] text-slate-500">Draw zones first.</p>
                            )}
                            {settings.zones.map((zone) => (
                              <label key={zone.id} className="flex items-center gap-2 text-[11px] text-slate-400">
                                <input
                                  type="checkbox"
                                  checked={prop.placement.allowedZoneIds.includes(zone.id)}
                                  onChange={() => togglePropZone(prop.id, zone.id)}
                                />
                                {zone.name}
                              </label>
                            ))}
                            <p className="text-[11px] text-slate-500">
                              No zones selected = place anywhere for this prop.
                            </p>
                          </div>
                        )}

                        <label className="mb-2 flex items-center gap-2 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={prop.placement.useCustomDensity}
                            onChange={(event) =>
                              updatePropPlacement(prop.id, { useCustomDensity: event.target.checked })
                            }
                          />
                          Custom density rules
                        </label>
                        {prop.placement.useCustomDensity && (
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-[11px] text-slate-400">
                              Cell size
                              <input
                                type="number"
                                min={2}
                                value={prop.placement.densityCellSize}
                                onChange={(event) =>
                                  updatePropPlacement(prop.id, {
                                    densityCellSize: Number(event.target.value) || 10,
                                  })
                                }
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                              />
                            </label>
                            <label className="text-[11px] text-slate-400">
                              Max / cell
                              <input
                                type="number"
                                min={1}
                                value={prop.placement.maxPropsPerCell}
                                onChange={(event) =>
                                  updatePropPlacement(prop.id, {
                                    maxPropsPerCell: Number(event.target.value) || 1,
                                  })
                                }
                                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                              />
                            </label>
                          </div>
                        )}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div>
        </AdminSection>
      </div>
    </aside>
  )
}
