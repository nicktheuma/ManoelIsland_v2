type RateLimitOverlayProps = {
  secondsRemaining: number
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function RateLimitOverlay({ secondsRemaining }: RateLimitOverlayProps) {
  if (secondsRemaining <= 0) return null

  return (
    <div className="pointer-events-none absolute bottom-24 left-1/2 z-20 -translate-x-1/2">
      <div className="rounded-lg border border-amber-500/40 bg-slate-900/90 px-4 py-2 text-center text-sm text-amber-100 shadow-lg backdrop-blur">
        <p className="font-medium">Rate limit active</p>
        <p className="text-amber-200/80">
          Next placement in {formatCountdown(secondsRemaining)}
        </p>
      </div>
    </div>
  )
}
