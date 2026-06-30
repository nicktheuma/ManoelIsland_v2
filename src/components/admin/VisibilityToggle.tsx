type VisibilityToggleProps = {
  visible: boolean
  onToggle: () => void
  label?: string
}

export function VisibilityToggle({ visible, onToggle, label = 'Show to users' }: VisibilityToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={visible ? `${label}: visible` : `${label}: hidden`}
      className={`rounded-md p-1.5 transition-colors ${
        visible
          ? 'bg-sky-500/20 text-sky-300 hover:bg-sky-500/30'
          : 'bg-slate-700/60 text-slate-500 hover:bg-slate-700'
      }`}
      aria-label={visible ? 'Visible to users' : 'Hidden from users'}
    >
      {visible ? (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      )}
    </button>
  )
}
