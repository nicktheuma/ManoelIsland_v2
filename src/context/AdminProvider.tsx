import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { ADMIN_SESSION_KEY, getAdminPassword } from '../config/defaults'
import { useSandbox } from './SandboxProvider'
import type { AllowedZone } from '../types/sandbox'

type AdminContextValue = {
  isAdmin: boolean
  isPanelOpen: boolean
  isLoginOpen: boolean
  zoneDrawingMode: boolean
  draftZonePoints: [number, number][]
  login: (password: string) => boolean
  logout: () => void
  openLogin: () => void
  closeLogin: () => void
  togglePanel: () => void
  setZoneDrawingMode: (enabled: boolean) => void
  addDraftZonePoint: (point: [number, number]) => void
  clearDraftZone: () => void
  finishDraftZone: (name: string) => AllowedZone | null
}

const AdminContext = createContext<AdminContextValue | null>(null)

export function AdminProvider({ children }: { children: ReactNode }) {
  const { patchSettings, settings } = useSandbox()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [zoneDrawingMode, setZoneDrawingMode] = useState(false)
  const [draftZonePoints, setDraftZonePoints] = useState<[number, number][]>([])

  useEffect(() => {
    setIsAdmin(sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true')
  }, [])

  const login = useCallback((password: string) => {
    if (password !== getAdminPassword()) return false
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true')
    setIsAdmin(true)
    setIsLoginOpen(false)
    setIsPanelOpen(true)
    return true
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY)
    setIsAdmin(false)
    setIsPanelOpen(false)
    setZoneDrawingMode(false)
    setDraftZonePoints([])
  }, [])

  const finishDraftZone = useCallback(
    (name: string): AllowedZone | null => {
      if (draftZonePoints.length < 3) return null
      const zone: AllowedZone = {
        id: crypto.randomUUID(),
        name,
        points: draftZonePoints,
        color: '#22d3ee',
      }
      patchSettings({ zones: [...settings.zones, zone] })
      setDraftZonePoints([])
      setZoneDrawingMode(false)
      return zone
    },
    [draftZonePoints, patchSettings, settings.zones],
  )

  const value = useMemo<AdminContextValue>(
    () => ({
      isAdmin,
      isPanelOpen,
      isLoginOpen,
      zoneDrawingMode,
      draftZonePoints,
      login,
      logout,
      openLogin: () => setIsLoginOpen(true),
      closeLogin: () => setIsLoginOpen(false),
      togglePanel: () => setIsPanelOpen((open) => !open),
      setZoneDrawingMode,
      addDraftZonePoint: (point) => setDraftZonePoints((points) => [...points, point]),
      clearDraftZone: () => setDraftZonePoints([]),
      finishDraftZone,
    }),
    [
      isAdmin,
      isPanelOpen,
      isLoginOpen,
      zoneDrawingMode,
      draftZonePoints,
      login,
      logout,
      finishDraftZone,
    ],
  )

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin(): AdminContextValue {
  const context = useContext(AdminContext)
  if (!context) throw new Error('useAdmin must be used within AdminProvider')
  return context
}
