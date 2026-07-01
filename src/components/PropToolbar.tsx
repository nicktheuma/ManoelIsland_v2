import { getUserPlaceableProps } from '../utils/placementRules'
import { useAdmin } from '../context/AdminProvider'
import { useSandbox } from '../context/SandboxProvider'
import { useTerrainSculpt } from '../context/TerrainSculptProvider'
import {
  isPlacementMode,
  isSculptMode,
  sculptToolFromMode,
  visibleInteractionModes,
  type InteractionMode,
} from '../types/interaction'
import { ModeToggle } from './ModeToggle'

type PropToolbarProps = {
  mode: InteractionMode
  onModeChange: (mode: InteractionMode) => void
  selectedPropId: string
  onSelectProp: (propId: string) => void
  isTouchDevice: boolean
  hasPreview: boolean
  onPlaceConfirm: () => void
}

export function PropToolbar({
  mode,
  onModeChange,
  selectedPropId,
  onSelectProp,
  isTouchDevice,
  hasPreview,
  onPlaceConfirm,
}: PropToolbarProps) {
  const { settings, placedProps, canUndo, canRedo, undo, redo, placementError, clearPlacementError, isLayoutLocked } =
    useSandbox()
  const { isAdmin } = useAdmin()
  const { brush, setBrush, sculptError, setSculptError } = useTerrainSculpt()

  if (!settings.userVisibility.showPropToolbar) return null

  const placeableProps = getUserPlaceableProps(settings)
  const placementMode = isPlacementMode(mode)
  const sculptMode = isSculptMode(mode)
  const sculptTool = sculptToolFromMode(mode)
  const modeOptions = visibleInteractionModes(settings.userVisibility.showSculptTools)

  const sculptBlocked = isLayoutLocked && !isAdmin
  const placementBlocked = isLayoutLocked && !isAdmin

  const hint = settings.userVisibility.showPlacementHints
    ? sculptBlocked && sculptMode
      ? 'Layout locked — terrain sculpting is disabled'
      : placementBlocked && placementMode
        ? 'Layout locked — new placements are disabled'
        : sculptMode
          ? isTouchDevice
            ? `${sculptTool === 'excavate' ? 'Excavate' : 'Fill'} · One finger to sculpt · Two fingers to rotate`
            : `${sculptTool === 'excavate' ? 'Excavate' : 'Fill'} · Left drag to sculpt · Right drag to rotate · Middle drag to pan · Scroll to zoom`
          : placementMode
            ? isTouchDevice
              ? 'Place mode · Drag to position · Tap or Place to confirm'
              : 'Place mode · Hover to preview · Click terrain to place'
            : 'Edit mode · Click a prop to select · Click terrain to deselect'
    : null

  return (
    <div className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
      {hint && (
        <p className="max-w-lg rounded-full bg-slate-900/80 px-4 py-1 text-center text-sm text-slate-300 backdrop-blur">
          {hint} · {placedProps.length} placed
        </p>
      )}

      {(placementError && placementMode) || (sculptError && sculptMode) ? (
        <button
          type="button"
          onClick={() => {
            clearPlacementError()
            setSculptError(null)
          }}
          className="rounded-full bg-red-950/90 px-4 py-1 text-sm text-red-200 backdrop-blur"
        >
          {(sculptError ?? placementError) + ' · dismiss'}
        </button>
      ) : null}

      <div className="flex max-w-[95vw] flex-wrap items-center justify-center gap-2 rounded-xl bg-slate-900/90 p-2 backdrop-blur">
        <ModeToggle mode={mode} onChange={onModeChange} modes={modeOptions} />

        {sculptMode && settings.userVisibility.showSculptTools && (
          <>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              Radius
              <input
                type="range"
                min={2}
                max={40}
                step={1}
                value={brush.radius}
                onChange={(event) => setBrush({ radius: Number(event.target.value) })}
                className="w-24"
              />
              <span className="w-6 text-right text-slate-300">{brush.radius}</span>
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              Strength
              <input
                type="range"
                min={0.1}
                max={8}
                step={0.1}
                value={brush.strength}
                onChange={(event) => setBrush({ strength: Number(event.target.value) })}
                className="w-24"
              />
              <span className="w-8 text-right text-slate-300">{brush.strength.toFixed(1)}</span>
            </label>
          </>
        )}

        {placementMode &&
          placeableProps.map((prop) => (
            <button
              key={prop.id}
              type="button"
              onClick={() => onSelectProp(prop.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                selectedPropId === prop.id
                  ? 'bg-sky-500 text-white'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {prop.name}
            </button>
          ))}

        {settings.userVisibility.showUndoRedo && (
          <>
            <button
              type="button"
              disabled={!canUndo}
              onClick={undo}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              Undo
            </button>
            <button
              type="button"
              disabled={!canRedo}
              onClick={redo}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              Redo
            </button>
          </>
        )}

        {placementMode && isTouchDevice && hasPreview && (
          <button
            type="button"
            onClick={onPlaceConfirm}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400"
          >
            Place
          </button>
        )}
      </div>
    </div>
  )
}
