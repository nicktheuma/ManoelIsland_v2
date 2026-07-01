import type { TerrainLayerNudges, TerrainWaterLayerNudge } from '../../types/sandbox'
import {
  isDefaultLayerNudge,
  isDefaultWaterLayerNudge,
  SCALE_MAX,
  SCALE_MIN,
} from '../../utils/terrainLayerNudge'

const XY_MIN = -100
const XY_MAX = 100
const XY_STEP = 0.5
const HEIGHT_MIN = -20
const HEIGHT_MAX = 20
const HEIGHT_STEP = 0.05
const SCALE_STEP = 0.01

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

type NudgeSliderRowProps = {
  label: string
  value: number
  min: number
  max: number
  step: number
  disabled?: boolean
  onChange: (value: number) => void
}

function NudgeSliderRow({ label, value, min, max, step, disabled, onChange }: NudgeSliderRowProps) {
  const stepBy = (delta: number) => {
    onChange(clamp(Number((value + delta).toFixed(4)), min, max))
  }

  const decimals = step < 0.05 ? 3 : step < 1 ? 2 : 1

  return (
    <div className="space-y-1">
      <span className="text-xs text-slate-400">
        {label}: {value.toFixed(decimals)}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= min}
          onClick={() => stepBy(-step)}
          className="shrink-0 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        >
          ▼
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={disabled}
          className="min-w-0 flex-1 disabled:opacity-40"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={disabled || value >= max}
          onClick={() => stepBy(step)}
          className="shrink-0 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        >
          ▲
        </button>
      </div>
    </div>
  )
}

type TerrainLayerNudgePanelProps = {
  layer: keyof TerrainLayerNudges
  label: string
  nudge: TerrainLayerNudges[keyof TerrainLayerNudges]
  disabled?: boolean
  showHeight?: boolean
  showOffset?: boolean
  showScale?: boolean
  onUpdate: (
    layer: keyof TerrainLayerNudges,
    patch: Partial<TerrainLayerNudges[keyof TerrainLayerNudges]>,
  ) => void
  onReset: (layer: keyof TerrainLayerNudges) => void
}

export function TerrainLayerNudgePanel({
  layer,
  label,
  nudge,
  disabled,
  showHeight = false,
  showOffset = true,
  showScale = false,
  onUpdate,
  onReset,
}: TerrainLayerNudgePanelProps) {
  const waterNudge = showHeight ? (nudge as TerrainWaterLayerNudge) : null
  const isDefault = showHeight
    ? isDefaultWaterLayerNudge(nudge as TerrainWaterLayerNudge)
    : isDefaultLayerNudge(nudge)

  return (
    <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-200">{label}</p>
        <button
          type="button"
          onClick={() => onReset(layer)}
          disabled={disabled || isDefault}
          className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800 disabled:opacity-40"
        >
          Reset
        </button>
      </div>
      {showOffset && (
        <>
          <NudgeSliderRow
            label="X offset (east–west)"
            value={nudge.x}
            min={XY_MIN}
            max={XY_MAX}
            step={XY_STEP}
            disabled={disabled}
            onChange={(x) => onUpdate(layer, { x })}
          />
          <NudgeSliderRow
            label="Y offset (north–south)"
            value={nudge.y}
            min={XY_MIN}
            max={XY_MAX}
            step={XY_STEP}
            disabled={disabled}
            onChange={(y) => onUpdate(layer, { y })}
          />
        </>
      )}
      {showScale && (
        <>
          <NudgeSliderRow
            label="X scale"
            value={nudge.scaleX}
            min={SCALE_MIN}
            max={SCALE_MAX}
            step={SCALE_STEP}
            disabled={disabled}
            onChange={(scaleX) => onUpdate(layer, { scaleX })}
          />
          <NudgeSliderRow
            label="Y scale"
            value={nudge.scaleY}
            min={SCALE_MIN}
            max={SCALE_MAX}
            step={SCALE_STEP}
            disabled={disabled}
            onChange={(scaleY) => onUpdate(layer, { scaleY })}
          />
        </>
      )}
      {showHeight && waterNudge && (
        <NudgeSliderRow
          label="Height (above MSL, syncs terrain clip)"
          value={waterNudge.height}
          min={HEIGHT_MIN}
          max={HEIGHT_MAX}
          step={HEIGHT_STEP}
          disabled={disabled}
          onChange={(height) => onUpdate(layer, { height })}
        />
      )}
    </div>
  )
}

export function TerrainLayerNudgePanels({
  layerNudges,
  disabled,
  onUpdate,
  onReset,
}: {
  layerNudges: TerrainLayerNudges
  disabled?: boolean
  onUpdate: (
    layer: keyof TerrainLayerNudges,
    patch: Partial<TerrainLayerNudges[keyof TerrainLayerNudges]>,
  ) => void
  onReset: (layer: keyof TerrainLayerNudges) => void
}) {
  return (
    <>
      <TerrainLayerNudgePanel
        layer="heightmap"
        label="Heightmap (displaced mesh)"
        nudge={layerNudges.heightmap}
        disabled={disabled}
        showOffset={false}
        showScale
        onUpdate={onUpdate}
        onReset={onReset}
      />
      <TerrainLayerNudgePanel
        layer="surface"
        label="Surface texture (orthophoto / grid)"
        nudge={layerNudges.surface}
        disabled={disabled}
        showScale
        onUpdate={onUpdate}
        onReset={onReset}
      />
      <TerrainLayerNudgePanel
        layer="osm"
        label="OSM buildings & trees"
        nudge={layerNudges.osm}
        disabled={disabled}
        showScale
        onUpdate={onUpdate}
        onReset={onReset}
      />
      <TerrainLayerNudgePanel
        layer="surround"
        label="Distant surround terrain"
        nudge={layerNudges.surround}
        disabled={disabled}
        onUpdate={onUpdate}
        onReset={onReset}
      />
      <TerrainLayerNudgePanel
        layer="water"
        label="Water plane"
        nudge={layerNudges.water}
        disabled={disabled}
        showHeight
        onUpdate={onUpdate}
        onReset={onReset}
      />
    </>
  )
}
