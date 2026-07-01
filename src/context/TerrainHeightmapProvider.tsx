import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { HEIGHTMAP_URL } from '../constants/terrain'
import { normalizeSceneAppearance } from '../config/sceneAppearance'
import {
  loadCachedHeightmapUrl,
  loadCachedSurfaceUrl,
  saveCachedHeightmapUrl,
  saveCachedSurfaceUrl,
} from '../config/terrainSettings'
import { useSandbox } from './SandboxProvider'
import { buildHeightmapFromPolygon, type DemSampleProgress } from '../utils/demHeightmap'
import { heightmapToImageData } from '../utils/terrainHeight'
import {
  applySurfacePresentation,
  buildTerrainSurface,
  type SurfaceBuildProgress,
} from '../utils/terrainSurface'
import type { LatLng, TerrainSettings } from '../types/sandbox'

type TerrainHeightmapContextValue = {
  imageData: ImageData | null
  maxHeight: number
  surfaceCanvas: HTMLCanvasElement | null
  isLoading: boolean
  progress: DemSampleProgress | null
  error: string | null
  isSurfaceLoading: boolean
  surfaceProgress: SurfaceBuildProgress | null
  surfaceError: string | null
  generateFromPolygon: (
    polygon: LatLng[],
    settings: Pick<TerrainSettings, 'sampleSize' | 'maxHeight'>,
  ) => Promise<TerrainSettings | null>
  generateSurfaceFromPolygon: (
    polygon: LatLng[],
    settings: Pick<TerrainSettings, 'sampleSize' | 'surfaceStyle'>,
  ) => Promise<TerrainSettings | null>
}

const TerrainHeightmapContext = createContext<TerrainHeightmapContextValue | null>(null)

async function loadImageDataFromUrl(url: string): Promise<ImageData> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load heightmap image.'))
    img.src = url
  })
  return heightmapToImageData(image)
}

async function loadCanvasFromUrl(url: string): Promise<HTMLCanvasElement> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load terrain surface image.'))
    img.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to read terrain surface image.')
  ctx.drawImage(image, 0, 0)
  return canvas
}

export function TerrainHeightmapProvider({ children }: { children: ReactNode }) {
  const { settings } = useSandbox()
  const appearance = normalizeSceneAppearance(settings.sceneAppearance)
  const terrain = appearance.terrain

  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<DemSampleProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [rawSurfaceUrl, setRawSurfaceUrl] = useState<string | null>(null)
  const [surfaceCanvas, setSurfaceCanvas] = useState<HTMLCanvasElement | null>(null)
  const [isSurfaceLoading, setIsSurfaceLoading] = useState(false)
  const [surfaceProgress, setSurfaceProgress] = useState<SurfaceBuildProgress | null>(null)
  const [surfaceError, setSurfaceError] = useState<string | null>(null)

  const loadIdRef = useRef(0)
  const surfaceLoadIdRef = useRef(0)

  const loadHeightmap = useCallback(async (nextTerrain: TerrainSettings) => {
    const loadId = ++loadIdRef.current
    setIsLoading(true)
    setError(null)
    setProgress(null)

    try {
      if (nextTerrain.source === 'procedural') {
        const data = await loadImageDataFromUrl(HEIGHTMAP_URL)
        if (loadId !== loadIdRef.current) return
        setImageData(data)
        return
      }

      const cachedUrl = loadCachedHeightmapUrl(nextTerrain)
      if (cachedUrl) {
        const data = await loadImageDataFromUrl(cachedUrl)
        if (loadId !== loadIdRef.current) return
        setImageData(data)
        return
      }

      const result = await buildHeightmapFromPolygon(
        nextTerrain.polygon,
        nextTerrain.sampleSize,
        nextTerrain,
        setProgress,
      )
      if (loadId !== loadIdRef.current) return

      saveCachedHeightmapUrl(nextTerrain, result.objectUrl)
      setImageData(result.imageData)
    } catch (loadError) {
      if (loadId !== loadIdRef.current) return
      setError(loadError instanceof Error ? loadError.message : 'Heightmap load failed.')
      try {
        const fallback = await loadImageDataFromUrl(HEIGHTMAP_URL)
        if (loadId === loadIdRef.current) setImageData(fallback)
      } catch {
        setImageData(null)
      }
    } finally {
      if (loadId === loadIdRef.current) {
        setIsLoading(false)
        setProgress(null)
      }
    }
  }, [])

  const loadSurface = useCallback(async (nextTerrain: TerrainSettings) => {
    const loadId = ++surfaceLoadIdRef.current

    if (nextTerrain.surfaceStyle === 'grid' || nextTerrain.surfaceVersion < 1) {
      setRawSurfaceUrl(null)
      setSurfaceCanvas(null)
      setSurfaceError(null)
      return
    }

    setIsSurfaceLoading(true)
    setSurfaceError(null)
    setSurfaceProgress(null)

    try {
      const cachedUrl = loadCachedSurfaceUrl(nextTerrain)
      if (cachedUrl) {
        if (loadId !== surfaceLoadIdRef.current) return
        setRawSurfaceUrl(cachedUrl)
        return
      }

      const result = await buildTerrainSurface(
        nextTerrain.polygon,
        nextTerrain.sampleSize,
        nextTerrain,
        nextTerrain.surfaceStyle,
        setSurfaceProgress,
      )
      if (loadId !== surfaceLoadIdRef.current) return

      saveCachedSurfaceUrl(nextTerrain, result.objectUrl)
      setRawSurfaceUrl(result.objectUrl)
    } catch (loadError) {
      if (loadId !== surfaceLoadIdRef.current) return
      setSurfaceError(loadError instanceof Error ? loadError.message : 'Terrain surface load failed.')
      setRawSurfaceUrl(null)
      setSurfaceCanvas(null)
    } finally {
      if (loadId === surfaceLoadIdRef.current) {
        setIsSurfaceLoading(false)
        setSurfaceProgress(null)
      }
    }
  }, [])

  useEffect(() => {
    void loadHeightmap(terrain)
  }, [loadHeightmap, terrain.source, terrain.version, terrain.sampleSize, terrain.originLat, terrain.originLng, terrain.spanLat, terrain.spanLng])

  useEffect(() => {
    void loadSurface(terrain)
  }, [loadSurface, terrain.surfaceStyle, terrain.surfaceVersion, terrain.sampleSize, terrain.version])

  useEffect(() => {
    if (!rawSurfaceUrl || terrain.surfaceStyle === 'grid') {
      setSurfaceCanvas(null)
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const rawCanvas = await loadCanvasFromUrl(rawSurfaceUrl)
        if (cancelled) return

        const presented = applySurfacePresentation(rawCanvas, {
          surfaceOpacity: terrain.surfaceOpacity,
          showGridOverlay: terrain.showGridOverlay,
          fillColor: appearance.terrainFillColor,
          gridColor: appearance.terrainGridColor,
          fillOpacity: appearance.terrainFillOpacity,
        })
        setSurfaceCanvas(presented)
      } catch (presentError) {
        if (!cancelled) {
          setSurfaceError(
            presentError instanceof Error ? presentError.message : 'Terrain surface presentation failed.',
          )
          setSurfaceCanvas(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    rawSurfaceUrl,
    terrain.surfaceStyle,
    terrain.surfaceOpacity,
    terrain.showGridOverlay,
    appearance.terrainFillColor,
    appearance.terrainGridColor,
    appearance.terrainFillOpacity,
  ])

  const generateFromPolygon = useCallback(
    async (
      polygon: LatLng[],
      next: Pick<TerrainSettings, 'sampleSize' | 'maxHeight'>,
    ): Promise<TerrainSettings | null> => {
      if (polygon.length < 3) return null

      const loadId = ++loadIdRef.current
      setIsLoading(true)
      setError(null)

      try {
        const draftSettings: TerrainSettings = {
          ...terrain,
          source: 'dem',
          polygon,
          sampleSize: next.sampleSize,
          maxHeight: next.maxHeight,
          version: terrain.version + 1,
          lastMinElevation: null,
          lastMaxElevation: null,
          lastZoom: null,
        }

        const result = await buildHeightmapFromPolygon(polygon, next.sampleSize, draftSettings, setProgress)
        if (loadId !== loadIdRef.current) return null

        saveCachedHeightmapUrl(draftSettings, result.objectUrl)
        setImageData(result.imageData)

        return {
          ...draftSettings,
          lastMinElevation: result.min,
          lastMaxElevation: result.max,
          lastZoom: result.zoom,
        }
      } catch (generateError) {
        if (loadId === loadIdRef.current) {
          setError(
            generateError instanceof Error ? generateError.message : 'Heightmap generation failed.',
          )
        }
        return null
      } finally {
        if (loadId === loadIdRef.current) {
          setIsLoading(false)
          setProgress(null)
        }
      }
    },
    [terrain],
  )

  const generateSurfaceFromPolygon = useCallback(
    async (
      polygon: LatLng[],
      next: Pick<TerrainSettings, 'sampleSize' | 'surfaceStyle'>,
    ): Promise<TerrainSettings | null> => {
      if (polygon.length < 3) return null
      if (next.surfaceStyle === 'grid') return null

      const loadId = ++surfaceLoadIdRef.current
      setIsSurfaceLoading(true)
      setSurfaceError(null)

      try {
        const draftSettings: TerrainSettings = {
          ...terrain,
          polygon,
          sampleSize: next.sampleSize,
          surfaceStyle: next.surfaceStyle,
          surfaceVersion: terrain.surfaceVersion + 1,
          lastSurfaceZoom: null,
        }

        const result = await buildTerrainSurface(
          polygon,
          next.sampleSize,
          draftSettings,
          next.surfaceStyle,
          setSurfaceProgress,
        )
        if (loadId !== surfaceLoadIdRef.current) return null

        saveCachedSurfaceUrl(draftSettings, result.objectUrl)
        setRawSurfaceUrl(result.objectUrl)

        return {
          ...draftSettings,
          lastSurfaceZoom: result.zoom,
        }
      } catch (generateError) {
        if (loadId === surfaceLoadIdRef.current) {
          setSurfaceError(
            generateError instanceof Error ? generateError.message : 'Terrain surface generation failed.',
          )
        }
        return null
      } finally {
        if (loadId === surfaceLoadIdRef.current) {
          setIsSurfaceLoading(false)
          setSurfaceProgress(null)
        }
      }
    },
    [terrain],
  )

  const value = useMemo<TerrainHeightmapContextValue>(
    () => ({
      imageData,
      maxHeight: terrain.maxHeight,
      surfaceCanvas,
      isLoading,
      progress,
      error,
      isSurfaceLoading,
      surfaceProgress,
      surfaceError,
      generateFromPolygon,
      generateSurfaceFromPolygon,
    }),
    [
      generateFromPolygon,
      generateSurfaceFromPolygon,
      imageData,
      isLoading,
      progress,
      error,
      isSurfaceLoading,
      surfaceProgress,
      surfaceError,
      surfaceCanvas,
      terrain.maxHeight,
    ],
  )

  return (
    <TerrainHeightmapContext.Provider value={value}>{children}</TerrainHeightmapContext.Provider>
  )
}

export function useTerrainHeightmap(): TerrainHeightmapContextValue {
  const context = useContext(TerrainHeightmapContext)
  if (!context) {
    throw new Error('useTerrainHeightmap must be used within TerrainHeightmapProvider')
  }
  return context
}
