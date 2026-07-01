let secondsRemaining = 0
const listeners = new Set<() => void>()

export function publishSculptRateLimitSeconds(seconds: number) {
  if (seconds === secondsRemaining) return
  secondsRemaining = Math.max(0, Math.ceil(seconds))
  for (const listener of listeners) listener()
}

export function subscribeSculptRateLimitSeconds(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSculptRateLimitSecondsRemaining() {
  return secondsRemaining
}
