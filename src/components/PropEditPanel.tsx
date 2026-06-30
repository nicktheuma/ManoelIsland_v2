import { useAdmin } from '../context/AdminProvider'
import { useSandbox } from '../context/SandboxProvider'
import { isEditMode, type InteractionMode } from '../types/interaction'

type PropEditPanelProps = {
  mode: InteractionMode
}

export function PropEditPanel({ mode }: PropEditPanelProps) {
  const { isAdmin } = useAdmin()
  const { selectedPropId, placedProps, updateProp, deleteSelected, getPropDefinition, selectProp } =
    useSandbox()
  const selected = placedProps.find((prop) => prop.id === selectedPropId)

  if (!isEditMode(mode) || !selected) return null

  const definition = getPropDefinition(selected.propId)
  const isLocked = Boolean(selected.isLocked) && !isAdmin

  return (
    <aside className="pointer-events-auto absolute left-4 top-4 z-30 w-72 rounded-xl border border-slate-700 bg-slate-900/95 p-4 shadow-xl backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-white">Edit Prop</h3>
          <p className="text-xs text-slate-400">{definition?.name ?? selected.propId}</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => selectProp(null)}
            className="rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
          >
            Close
          </button>
          {!isLocked && (
            <button
              type="button"
              onClick={() => deleteSelected()}
              className="rounded-lg px-2 py-1 text-xs text-red-300 hover:bg-slate-800"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {isLocked && (
        <p className="mb-3 rounded-md border border-amber-500/30 bg-amber-950/40 px-2 py-1.5 text-xs text-amber-200">
          This prop is locked. Only admins can edit it.
        </p>
      )}

      <label className="mb-3 block text-xs text-slate-300">
        Rotation Y
        <input
          type="range"
          min={-3.14}
          max={3.14}
          step={0.05}
          value={selected.rotation[1]}
          disabled={isLocked}
          onChange={(event) =>
            updateProp(selected.id, {
              rotation: [selected.rotation[0], Number(event.target.value), selected.rotation[2]],
            })
          }
          className="mt-1 w-full disabled:opacity-40"
        />
      </label>

      <label className="mb-3 block text-xs text-slate-300">
        Scale
        <input
          type="range"
          min={0.25}
          max={3}
          step={0.05}
          value={selected.scale}
          disabled={isLocked}
          onChange={(event) => updateProp(selected.id, { scale: Number(event.target.value) })}
          className="mt-1 w-full disabled:opacity-40"
        />
      </label>

      <label className="mb-3 block text-xs text-slate-300">
        Color
        <input
          type="color"
          value={selected.color}
          disabled={isLocked}
          onChange={(event) => updateProp(selected.id, { color: event.target.value })}
          className="mt-1 h-9 w-full cursor-pointer rounded border border-slate-700 bg-slate-950 disabled:opacity-40"
        />
      </label>

      <label className="block text-xs text-slate-300">
        Metadata (JSON)
        <textarea
          rows={4}
          value={JSON.stringify(selected.metadata, null, 2)}
          disabled={isLocked}
          onChange={(event) => {
            try {
              updateProp(selected.id, { metadata: JSON.parse(event.target.value) as Record<string, unknown> })
            } catch {
              // ignore invalid JSON while typing
            }
          }}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 font-mono text-[11px] text-slate-200 disabled:opacity-40"
        />
      </label>
    </aside>
  )
}
