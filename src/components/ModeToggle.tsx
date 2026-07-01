import { INTERACTION_MODES, isSculptMode, type InteractionMode } from '../types/interaction'

type ModeToggleProps = {
  mode: InteractionMode
  onChange: (mode: InteractionMode) => void
  modes?: InteractionMode[]
}

function modeButtonClass(id: InteractionMode, active: boolean): string {
  if (!active) return 'text-slate-300 hover:bg-slate-700'
  if (id === 'edit') return 'bg-violet-500 text-white'
  if (id === 'excavate') return 'bg-amber-600 text-white'
  if (id === 'fill') return 'bg-emerald-600 text-white'
  return 'bg-sky-500 text-white'
}

export function ModeToggle({ mode, onChange, modes }: ModeToggleProps) {
  const visibleModes = modes
    ? INTERACTION_MODES.filter(({ id }) => modes.includes(id))
    : INTERACTION_MODES

  return (
    <div className="flex rounded-lg bg-slate-800 p-1">
      {visibleModes.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${modeButtonClass(id, mode === id)}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export { isSculptMode }
