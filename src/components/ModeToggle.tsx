import { INTERACTION_MODES, type InteractionMode } from '../types/interaction'

type ModeToggleProps = {
  mode: InteractionMode
  onChange: (mode: InteractionMode) => void
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="flex rounded-lg bg-slate-800 p-1">
      {INTERACTION_MODES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            mode === id
              ? id === 'edit'
                ? 'bg-violet-500 text-white'
                : 'bg-sky-500 text-white'
              : 'text-slate-300 hover:bg-slate-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
