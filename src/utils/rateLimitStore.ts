let secondsRemaining = 0
const listeners = new Set<() => void>()

export function publishRateLimitSeconds(seconds: number) {
  if (seconds === secondsRemaining) return
  secondsRemaining = seconds
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeRateLimitSeconds(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getRateLimitSecondsRemaining() {
  return secondsRemaining
}
