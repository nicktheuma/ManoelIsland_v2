import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react'

export type PreviewPlacementState = {
  visible: boolean
  position: [number, number, number]
  valid: boolean
}

type PlacementPreviewContextValue = {
  stateRef: React.MutableRefObject<PreviewPlacementState>
  subscribe: (listener: () => void) => () => void
  setPreview: (position: [number, number, number] | null, valid?: boolean) => void
  getPreview: () => PreviewPlacementState | null
}

const PlacementPreviewContext = createContext<PlacementPreviewContextValue | null>(null)

const HIDDEN: PreviewPlacementState = {
  visible: false,
  position: [0, 0, 0],
  valid: true,
}

export function PlacementPreviewProvider({ children }: { children: ReactNode }) {
  const stateRef = useRef<PreviewPlacementState>(HIDDEN)
  const listenersRef = useRef(new Set<() => void>())

  const notify = useCallback(() => {
    for (const listener of listenersRef.current) {
      listener()
    }
  }, [])

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener)
    return () => listenersRef.current.delete(listener)
  }, [])

  const setPreview = useCallback(
    (position: [number, number, number] | null, valid = true) => {
      if (!position) {
        if (!stateRef.current.visible) return
        stateRef.current = HIDDEN
        notify()
        return
      }

      const [x, y, z] = position
      const current = stateRef.current
      if (
        current.visible &&
        current.valid === valid &&
        current.position[0] === x &&
        current.position[1] === y &&
        current.position[2] === z
      ) {
        return
      }

      stateRef.current = { visible: true, position: [x, y, z], valid }
      notify()
    },
    [notify],
  )

  const getPreview = useCallback((): PreviewPlacementState | null => {
    const current = stateRef.current
    return current.visible ? current : null
  }, [])

  const value = useMemo(
    () => ({ stateRef, subscribe, setPreview, getPreview }),
    [subscribe, setPreview, getPreview],
  )

  return <PlacementPreviewContext.Provider value={value}>{children}</PlacementPreviewContext.Provider>
}

export function usePlacementPreview() {
  const context = useContext(PlacementPreviewContext)
  if (!context) {
    throw new Error('usePlacementPreview must be used within PlacementPreviewProvider')
  }
  return context
}
