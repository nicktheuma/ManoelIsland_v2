import type { PropType } from '../types/props'

const PROP_OPTIONS: { type: PropType; label: string }[] = [
  { type: 'tree', label: 'Tree' },
  { type: 'bench', label: 'Bench' },
  { type: 'pavilion', label: 'Pavilion' },
]

type PropToolbarProps = {
  selectedType: PropType
  onSelectType: (type: PropType) => void
  placedCount: number
  isTouchDevice: boolean
  hasPreview: boolean
  onPlaceConfirm: () => void
}

export function PropToolbar({
  selectedType,
  onSelectType,
  placedCount,
  isTouchDevice,
  hasPreview,
  onPlaceConfirm,
}: PropToolbarProps) {
  const hint = isTouchDevice
    ? 'Drag on the island to position · Tap or press Place to confirm'
    : 'Move cursor over the island · Click to place'

  return (
    <div className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
      <p className="max-w-md rounded-full bg-slate-900/80 px-4 py-1 text-center text-sm text-slate-300 backdrop-blur">
        {hint} · {placedCount} placed
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl bg-slate-900/90 p-2 backdrop-blur">
        {PROP_OPTIONS.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => onSelectType(type)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selectedType === type
                ? 'bg-sky-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
        {isTouchDevice && hasPreview && (
          <button
            type="button"
            onClick={onPlaceConfirm}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-400"
          >
            Place
          </button>
        )}
      </div>
    </div>
  )
}
