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
  loadCachedOsmFeatures,
  loadCachedSurfaceUrl,
  saveCachedHeightmapUrl,
  saveCachedOsmFeatures,
  saveCachedSurfaceUrl,
} from '../config/terrainSettings'
import { useSandbox } from './SandboxProvider'
import {
  buildHeightmapFromPolygon,
  elevationsToGrayscaleImageData,
  sampleDemGridFull,
  type DemSampleProgress,
} from '../utils/demHeightmap'
import { heightmapToImageData } from '../utils/terrainHeight'
import { buildOsmFeatureData, type OsmFeatureData } from '../utils/osmFeatures3d'
import { effectiveSurfaceSampleSize } from '../utils/terrainMeshQuality'
import {
  applySurfacePresentation,
  buildTerrainSurface,
  type SurfaceBuildProgress,
} from '../utils/terrainSurface'
import { extendedGeoReference, geoReferenceFromPolygon } from '../utils/geoReference'
import {
  terrainElevationContextFromSettings,
  seaLevelWorldY as computeSeaLevelWorldY,
  type TerrainElevationContext,
} from '../utils/terrainElevation'
import { computeTerrainAlignment, type TerrainAlignment } from '../utils/terrainAlignment'
import type { LatLng, TerrainSettings } from '../types/sandbox'

const SURROUND_SAMPLE_SIZE = 64

function heightmapTerrainKey(terrain: TerrainSettings): string {
  return `${terrain.version}-${terrain.sculptVersion}-${terrain.sampleSize}-${terrain.originLat.toFixed(6)}-${terrain.originLng.toFixed(6)}-${terrain.spanLat.toFixed(6)}-${terrain.spanLng.toFixed(6)}`
}

function surfaceTerrainKey(terrain: TerrainSettings): string {
  const polygonKey = terrain.polygon.map(([lat, lng]) => `${lat},${lng}`).join('|')
  return `${terrain.surfaceStyle}-${terrain.surfaceVersion}-${terrain.surfaceSampleSize}-${terrain.originLat.toFixed(6)}-${terrain.originLng.toFixed(6)}-${terrain.spanLat.toFixed(6)}-${terrain.spanLng.toFixed(6)}-${polygonKey}`
}

type TerrainHeightmapContextValue = {
  imageData: ImageData | null
  /** Increments whenever heightmap pixel data changes (load, sculpt, undo). */
  imageDataGeneration: number
  elevationContext: TerrainElevationContext
  terrainAlignment: TerrainAlignment
  seaLevelWorldY: number
  surroundImageData: ImageData | null
  surroundElevationContext: TerrainElevationContext | null
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
    settings: Pick<TerrainSettings, 'surfaceSampleSize' | 'surfaceStyle'>,
  ) => Promise<TerrainSettings | null>
  osmFeatures: OsmFeatureData | null
  isOsmFeaturesLoading: boolean
  osmFeaturesProgress: number | null
  osmFeaturesError: string | null
  generateOsmFeaturesFromPolygon: (polygon: LatLng[]) => Promise<TerrainSettings | null>
  isSurroundLoading: boolean
  surroundError: string | null
  refreshSurroundTerrain: () => Promise<TerrainSettings | null>
  terrain: TerrainSettings
  setSculptImageData: (data: ImageData) => void
  resetToBaseHeightmap: () => Promise<boolean>
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
  const [imageDataGeneration, setImageDataGeneration] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState<DemSampleProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [rawSurfaceUrl, setRawSurfaceUrl] = useState<string | null>(null)
  const [surfaceCanvas, setSurfaceCanvas] = useState<HTMLCanvasElement | null>(null)
  const [isSurfaceLoading, setIsSurfaceLoading] = useState(false)
  const [surfaceProgress, setSurfaceProgress] = useState<SurfaceBuildProgress | null>(null)
  const [surfaceError, setSurfaceError] = useState<string | null>(null)

  const [osmFeatures, setOsmFeatures] = useState<OsmFeatureData | null>(null)
  const [isOsmFeaturesLoading, setIsOsmFeaturesLoading] = useState(false)
  const [osmFeaturesProgress, setOsmFeaturesProgress] = useState<number | null>(null)
  const [osmFeaturesError, setOsmFeaturesError] = useState<string | null>(null)

  const [surroundImageData, setSurroundImageData] = useState<ImageData | null>(null)
  const [surroundElevationContext, setSurroundElevationContext] =
    useState<TerrainElevationContext | null>(null)
  const [isSurroundLoading, setIsSurroundLoading] = useState(false)
  const [surroundError, setSurroundError] = useState<string | null>(null)

  const elevationContext = useMemo(
    () => terrainElevationContextFromSettings(terrain),
    [
      terrain.source,
      terrain.lastMinElevation,
      terrain.lastMaxElevation,
      terrain.maxHeight,
    ],
  )

  const terrainAlignment = useMemo(() => computeTerrainAlignment(terrain), [
    terrain.originLat,
    terrain.originLng,
    terrain.spanLat,
    terrain.spanLng,
  ])

  const seaLevelY = useMemo(
    () => computeSeaLevelWorldY(terrainAlignment.geo, elevationContext),
    [terrainAlignment, elevationContext],
  )

  const heightmapPassiveLoadIdRef = useRef(0)
  const heightmapGenerateIdRef = useRef(0)
  const heightmapSatisfiedKeyRef = useRef('')
  const imageDataRef = useRef<ImageData | null>(null)
  imageDataRef.current = imageData

  const commitImageData = useCallback((data: ImageData | null) => {
    setImageData(data)
    if (data) {
      setImageDataGeneration((generation) => generation + 1)
    }
  }, [])

  const surfacePassiveLoadIdRef = useRef(0)
  const surfaceGenerateIdRef = useRef(0)
  const surfaceSatisfiedKeyRef = useRef('')
  const rawSurfaceUrlRef = useRef<string | null>(null)
  rawSurfaceUrlRef.current = rawSurfaceUrl

  const osmLoadIdRef = useRef(0)

  const surroundLoadIdRef = useRef(0)

  const loadSurroundHeightmap = useCallback(async (nextTerrain: TerrainSettings) => {
    const loadId = ++surroundLoadIdRef.current

    if (!nextTerrain.surroundEnabled || nextTerrain.source !== 'dem') {
      setSurroundImageData(null)
      setSurroundElevationContext(null)
      setSurroundError(null)
      setIsSurroundLoading(false)
      return
    }

    setIsSurroundLoading(true)
    setSurroundError(null)

    try {
      const surroundGeo = extendedGeoReference(nextTerrain, nextTerrain.surroundScale)
      const { elevations, min, max } = await sampleDemGridFull(SURROUND_SAMPLE_SIZE, surroundGeo)
      if (loadId !== surroundLoadIdRef.current) return

      const imageData = elevationsToGrayscaleImageData(elevations, SURROUND_SAMPLE_SIZE, min, max)
      setSurroundImageData(imageData)
      setSurroundElevationContext({
        minElevationM: min,
        maxElevationM: max,
        seaLevelM: 0,
        exaggeration: Math.max(0.25, nextTerrain.maxHeight),
      })
    } catch (loadError) {
      if (loadId === surroundLoadIdRef.current) {
        setSurroundImageData(null)
        setSurroundElevationContext(null)
        setSurroundError(
          loadError instanceof Error ? loadError.message : 'Surround terrain load failed.',
        )
      }
    } finally {
      if (loadId === surroundLoadIdRef.current) {
        setIsSurroundLoading(false)
      }
    }
  }, [])

  const loadHeightmap = useCallback(async (nextTerrain: TerrainSettings) => {
    const terrainKey = heightmapTerrainKey(nextTerrain)
    if (
      nextTerrain.source === 'dem' &&
      nextTerrain.version >= 1 &&
      heightmapSatisfiedKeyRef.current === terrainKey &&
      imageDataRef.current !== null
    ) {
      return
    }

    const loadId = ++heightmapPassiveLoadIdRef.current
    setIsLoading(true)
    setError(null)
    setProgress(null)

    try {
      if (nextTerrain.source === 'procedural') {
        const data = await loadImageDataFromUrl(HEIGHTMAP_URL)
        if (loadId !== heightmapPassiveLoadIdRef.current) return
        commitImageData(data)
        heightmapSatisfiedKeyRef.current = terrainKey
        return
      }

      const cachedUrl = loadCachedHeightmapUrl(nextTerrain)
      if (cachedUrl) {
        const data = await loadImageDataFromUrl(cachedUrl)
        if (loadId !== heightmapPassiveLoadIdRef.current) return
        commitImageData(data)
        heightmapSatisfiedKeyRef.current = terrainKey
        void loadSurroundHeightmap(nextTerrain)
        return
      }

      const result = await buildHeightmapFromPolygon(
        nextTerrain.polygon,
        nextTerrain.sampleSize,
        nextTerrain,
        setProgress,
      )
      if (loadId !== heightmapPassiveLoadIdRef.current) return

      saveCachedHeightmapUrl(nextTerrain, result.objectUrl)
      commitImageData(result.imageData)
      heightmapSatisfiedKeyRef.current = terrainKey
      void loadSurroundHeightmap(nextTerrain)
    } catch (loadError) {
      if (loadId !== heightmapPassiveLoadIdRef.current) return
      setError(loadError instanceof Error ? loadError.message : 'Heightmap load failed.')
      if (nextTerrain.source === 'procedural') {
        try {
          const fallback = await loadImageDataFromUrl(HEIGHTMAP_URL)
          if (loadId === heightmapPassiveLoadIdRef.current) commitImageData(fallback)
        } catch {
          commitImageData(null)
        }
      }
    } finally {
      if (loadId === heightmapPassiveLoadIdRef.current) {
        setIsLoading(false)
        setProgress(null)
      }
    }
  }, [loadSurroundHeightmap])

  const loadSurface = useCallback(async (nextTerrain: TerrainSettings) => {
    if (nextTerrain.surfaceStyle === 'grid' || nextTerrain.surfaceVersion < 1) {
      surfaceSatisfiedKeyRef.current = ''
      setRawSurfaceUrl(null)
      setSurfaceCanvas(null)
      setSurfaceError(null)
      return
    }

    const terrainKey = surfaceTerrainKey(nextTerrain)
    if (surfaceSatisfiedKeyRef.current === terrainKey && rawSurfaceUrlRef.current !== null) {
      return
    }

    const loadId = ++surfacePassiveLoadIdRef.current
    setIsSurfaceLoading(true)
    setSurfaceError(null)
    setSurfaceProgress(null)

    try {
      const cachedUrl = loadCachedSurfaceUrl(nextTerrain)
      if (cachedUrl) {
        if (loadId !== surfacePassiveLoadIdRef.current) return
        setRawSurfaceUrl(cachedUrl)
        surfaceSatisfiedKeyRef.current = terrainKey
        return
      }

      const result = await buildTerrainSurface(
        nextTerrain.polygon,
        effectiveSurfaceSampleSize(nextTerrain),
        nextTerrain,
        nextTerrain.surfaceStyle,
        setSurfaceProgress,
      )
      if (loadId !== surfacePassiveLoadIdRef.current) return

      saveCachedSurfaceUrl(nextTerrain, result.objectUrl)
      setRawSurfaceUrl(result.objectUrl)
      surfaceSatisfiedKeyRef.current = terrainKey
    } catch (loadError) {
      if (loadId !== surfacePassiveLoadIdRef.current) return
      setSurfaceError(loadError instanceof Error ? loadError.message : 'Terrain surface load failed.')
      setRawSurfaceUrl(null)
      setSurfaceCanvas(null)
    } finally {
      if (loadId === surfacePassiveLoadIdRef.current) {
        setIsSurfaceLoading(false)
        setSurfaceProgress(null)
      }
    }
  }, [])

  useEffect(() => {
    void loadHeightmap(terrain)
  }, [
    loadHeightmap,
    terrain.source,
    terrain.version,
    terrain.sampleSize,
    terrain.originLat,
    terrain.originLng,
    terrain.spanLat,
    terrain.spanLng,
  ])

  const terrainPolygonKey = terrain.polygon.map(([lat, lng]) => `${lat},${lng}`).join('|')

  useEffect(() => {
    void loadSurface(terrain)
  }, [
    loadSurface,
    terrain.surfaceStyle,
    terrain.surfaceVersion,
    terrain.surfaceSampleSize,
    terrain.originLat,
    terrain.originLng,
    terrain.spanLat,
    terrain.spanLng,
    terrainPolygonKey,
  ])

  useEffect(() => {
    if (!imageData || !terrain.surroundEnabled || terrain.source !== 'dem') return
    void loadSurroundHeightmap(terrain)
  }, [
    imageData,
    loadSurroundHeightmap,
    terrain.surroundEnabled,
    terrain.surroundScale,
    terrain.surroundVersion,
    terrain.originLat,
    terrain.originLng,
    terrain.spanLat,
    terrain.spanLng,
    terrain.maxHeight,
    terrain.source,
  ])

  const loadOsmFeatures = useCallback(
    async (nextTerrain: TerrainSettings, heightData: ImageData) => {
      const loadId = ++osmLoadIdRef.current

      if (!nextTerrain.osmFeaturesEnabled || nextTerrain.osmFeaturesVersion < 1) {
        setOsmFeatures(null)
        setOsmFeaturesError(null)
        return
      }

      setIsOsmFeaturesLoading(true)
      setOsmFeaturesError(null)
      setOsmFeaturesProgress(null)

      try {
        const cached = loadCachedOsmFeatures(nextTerrain)
        if (cached) {
          const parsed = JSON.parse(cached) as OsmFeatureData
          if (loadId === osmLoadIdRef.current) setOsmFeatures(parsed)
          return
        }

        const data = await buildOsmFeatureData(
          nextTerrain.polygon,
          computeTerrainAlignment(nextTerrain),
          heightData,
          terrainElevationContextFromSettings(nextTerrain),
          setOsmFeaturesProgress,
        )
        if (loadId !== osmLoadIdRef.current) return

        saveCachedOsmFeatures(nextTerrain, JSON.stringify(data))
        setOsmFeatures(data)
      } catch (loadError) {
        if (loadId !== osmLoadIdRef.current) return
        setOsmFeaturesError(loadError instanceof Error ? loadError.message : 'OSM feature load failed.')
        setOsmFeatures(null)
      } finally {
        if (loadId === osmLoadIdRef.current) {
          setIsOsmFeaturesLoading(false)
          setOsmFeaturesProgress(null)
        }
      }
    },
    [],
  )

  useEffect(() => {
    if (!terrain.osmFeaturesEnabled) {
      setOsmFeatures(null)
      return
    }
    const data = imageDataRef.current
    if (!data) {
      setOsmFeatures(null)
      return
    }
    void loadOsmFeatures(terrain, data)
  }, [
    loadOsmFeatures,
    terrain.osmFeaturesEnabled,
    terrain.osmFeaturesVersion,
    terrain.originLat,
    terrain.originLng,
    terrain.spanLat,
    terrain.spanLng,
    terrain.maxHeight,
    terrain.version,
  ])

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

      const generationId = ++heightmapGenerateIdRef.current
      setIsLoading(true)
      setError(null)

      try {
        const geoFit = geoReferenceFromPolygon(polygon)
        const draftSettings: TerrainSettings = {
          ...terrain,
          ...geoFit,
          source: 'dem',
          polygon,
          sampleSize: next.sampleSize,
          maxHeight: next.maxHeight,
          version: terrain.version + 1,
          surroundVersion: terrain.surroundVersion + 1,
          lastMinElevation: null,
          lastMaxElevation: null,
          lastZoom: null,
        }

        const result = await buildHeightmapFromPolygon(polygon, next.sampleSize, draftSettings, setProgress)
        if (generationId !== heightmapGenerateIdRef.current) return null

        saveCachedHeightmapUrl(draftSettings, result.objectUrl)
        commitImageData(result.imageData)
        heightmapSatisfiedKeyRef.current = heightmapTerrainKey(draftSettings)
        void loadSurroundHeightmap(draftSettings)

        return {
          ...draftSettings,
          lastMinElevation: result.min,
          lastMaxElevation: result.max,
          lastZoom: result.zoom,
        }
      } catch (generateError) {
        if (generationId === heightmapGenerateIdRef.current) {
          setError(
            generateError instanceof Error ? generateError.message : 'Heightmap generation failed.',
          )
        }
        return null
      } finally {
        if (generationId === heightmapGenerateIdRef.current) {
          setIsLoading(false)
          setProgress(null)
        }
      }
    },
    [terrain, loadSurroundHeightmap],
  )

  const generateSurfaceFromPolygon = useCallback(
    async (
      polygon: LatLng[],
      next: Pick<TerrainSettings, 'surfaceSampleSize' | 'surfaceStyle'>,
    ): Promise<TerrainSettings | null> => {
      if (polygon.length < 3) return null
      if (next.surfaceStyle === 'grid') return null

      const generationId = ++surfaceGenerateIdRef.current
      setIsSurfaceLoading(true)
      setSurfaceError(null)

      try {
        const hasElevationGeo = terrain.source === 'dem' && terrain.version >= 1

        const geoFit = hasElevationGeo
          ? {
              originLat: terrain.originLat,
              originLng: terrain.originLng,
              spanLat: terrain.spanLat,
              spanLng: terrain.spanLng,
            }
          : geoReferenceFromPolygon(polygon)

        const draftSettings: TerrainSettings = {
          ...terrain,
          ...geoFit,
          polygon,
          surfaceSampleSize: next.surfaceSampleSize,
          surfaceStyle: next.surfaceStyle,
          surfaceVersion: terrain.surfaceVersion + 1,
          lastSurfaceZoom: null,
        }

        const result = await buildTerrainSurface(
          polygon,
          effectiveSurfaceSampleSize(draftSettings),
          draftSettings,
          next.surfaceStyle,
          setSurfaceProgress,
        )
        if (generationId !== surfaceGenerateIdRef.current) return null

        saveCachedSurfaceUrl(draftSettings, result.objectUrl)
        setRawSurfaceUrl(result.objectUrl)
        surfaceSatisfiedKeyRef.current = surfaceTerrainKey(draftSettings)

        return {
          ...draftSettings,
          lastSurfaceZoom: result.zoom,
        }
      } catch (generateError) {
        if (generationId === surfaceGenerateIdRef.current) {
          setSurfaceError(
            generateError instanceof Error ? generateError.message : 'Terrain surface generation failed.',
          )
        }
        return null
      } finally {
        if (generationId === surfaceGenerateIdRef.current) {
          setIsSurfaceLoading(false)
          setSurfaceProgress(null)
        }
      }
    },
    [terrain],
  )

  const generateOsmFeaturesFromPolygon = useCallback(
    async (polygon: LatLng[]): Promise<TerrainSettings | null> => {
      if (polygon.length < 3 || !imageData) return null

      const loadId = ++osmLoadIdRef.current
      setIsOsmFeaturesLoading(true)
      setOsmFeaturesError(null)

      try {
        const draftSettings: TerrainSettings = {
          ...terrain,
          polygon,
          osmFeaturesEnabled: true,
          osmFeaturesVersion: terrain.osmFeaturesVersion + 1,
        }

        const data = await buildOsmFeatureData(
          polygon,
          computeTerrainAlignment(draftSettings),
          imageData,
          terrainElevationContextFromSettings(draftSettings),
          setOsmFeaturesProgress,
        )
        if (loadId !== osmLoadIdRef.current) return null

        saveCachedOsmFeatures(draftSettings, JSON.stringify(data))
        setOsmFeatures(data)

        return draftSettings
      } catch (generateError) {
        if (loadId === osmLoadIdRef.current) {
          setOsmFeaturesError(
            generateError instanceof Error ? generateError.message : 'OSM feature generation failed.',
          )
        }
        return null
      } finally {
        if (loadId === osmLoadIdRef.current) {
          setIsOsmFeaturesLoading(false)
          setOsmFeaturesProgress(null)
        }
      }
    },
    [imageData, terrain],
  )

  const refreshSurroundTerrain = useCallback(async (): Promise<TerrainSettings | null> => {
    if (!terrain.surroundEnabled || terrain.source !== 'dem') return null

    const nextSettings: TerrainSettings = {
      ...terrain,
      surroundVersion: terrain.surroundVersion + 1,
    }
    await loadSurroundHeightmap(nextSettings)
    return nextSettings
  }, [loadSurroundHeightmap, terrain])

  const setSculptImageData = useCallback((data: ImageData) => {
    commitImageData(data)
  }, [commitImageData])

  const resetToBaseHeightmap = useCallback(async (): Promise<boolean> => {
    const baseTerrain = { ...terrain, sculptVersion: 0 }
    heightmapSatisfiedKeyRef.current = ''
    await loadHeightmap(baseTerrain)
    return imageDataRef.current !== null
  }, [loadHeightmap, terrain])

  const value = useMemo<TerrainHeightmapContextValue>(
    () => ({
      imageData,
      imageDataGeneration,
      elevationContext,
      terrainAlignment,
      seaLevelWorldY: seaLevelY,
      surroundImageData,
      surroundElevationContext,
      surfaceCanvas,
      isLoading,
      progress,
      error,
      isSurfaceLoading,
      surfaceProgress,
      surfaceError,
      generateFromPolygon,
      generateSurfaceFromPolygon,
      osmFeatures,
      isOsmFeaturesLoading,
      osmFeaturesProgress,
      osmFeaturesError,
      generateOsmFeaturesFromPolygon,
      isSurroundLoading,
      surroundError,
      refreshSurroundTerrain,
      terrain,
      setSculptImageData,
      resetToBaseHeightmap,
    }),
    [
      generateFromPolygon,
      generateSurfaceFromPolygon,
      generateOsmFeaturesFromPolygon,
      refreshSurroundTerrain,
      setSculptImageData,
      resetToBaseHeightmap,
      terrain,
      imageData,
      imageDataGeneration,
      elevationContext,
      terrainAlignment,
      seaLevelY,
      surroundImageData,
      surroundElevationContext,
      isSurroundLoading,
      surroundError,
      isLoading,
      progress,
      error,
      isSurfaceLoading,
      surfaceProgress,
      surfaceError,
      surfaceCanvas,
      osmFeatures,
      isOsmFeaturesLoading,
      osmFeaturesProgress,
      osmFeaturesError,
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
