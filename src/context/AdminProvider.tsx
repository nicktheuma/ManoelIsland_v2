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
import { notifyAdminSessionChanged } from '../hooks/useLocalAdminActive'
import {
  fetchMyProfile,
  loginWithSupabaseAdmin,
  restoreAnonymousSession,
  supportsSupabaseAdminAuth,
  type AdminProfile,
} from '../utils/adminAuth'
import { useSandbox } from './SandboxProvider'
import type { AllowedZone } from '../types/sandbox'

type AdminContextValue = {
  isAdmin: boolean
  isSupabaseAdmin: boolean
  adminProfile: AdminProfile | null
  isPanelOpen: boolean
  isLoginOpen: boolean
  zoneDrawingMode: boolean
  draftZonePoints: [number, number][]
  loginWithEmail: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>
  loginDev: (password: string) => boolean
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
  const { patchSettings, settings, registerAdminSession, clearAdminSession } = useSandbox()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isSupabaseAdmin, setIsSupabaseAdmin] = useState(false)
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isLoginOpen, setIsLoginOpen] = useState(false)
  const [zoneDrawingMode, setZoneDrawingMode] = useState(false)
  const [draftZonePoints, setDraftZonePoints] = useState<[number, number][]>([])

  const markAdminActive = useCallback((profile: AdminProfile | null, supabaseAuth: boolean) => {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true')
    setIsAdmin(true)
    setIsSupabaseAdmin(supabaseAuth)
    setAdminProfile(profile)
    setIsLoginOpen(false)
    setIsPanelOpen(true)
    notifyAdminSessionChanged()
  }, [])

  useEffect(() => {
    let cancelled = false

    async function restoreAdminSession() {
      if (supportsSupabaseAdminAuth()) {
        const profile = await fetchMyProfile()
        if (!cancelled && profile?.role === 'admin') {
          markAdminActive(profile, true)
          return
        }
      }

      if (sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true') {
        setIsAdmin(true)
        notifyAdminSessionChanged()
        void registerAdminSession(getAdminPassword())
      }
    }

    void restoreAdminSession()

    return () => {
      cancelled = true
    }
  }, [markAdminActive, registerAdminSession])

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const result = await loginWithSupabaseAdmin(email, password)
      if (!result.ok) return { ok: false, message: result.message }

      markAdminActive(result.profile, true)
      return { ok: true }
    },
    [markAdminActive],
  )

  const loginDev = useCallback(
    (password: string) => {
      if (password !== getAdminPassword()) return false
      markAdminActive(null, false)
      void registerAdminSession(password)
      return true
    },
    [markAdminActive, registerAdminSession],
  )

  const logout = useCallback(() => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY)
    setIsAdmin(false)
    setIsSupabaseAdmin(false)
    setAdminProfile(null)
    setIsPanelOpen(false)
    setZoneDrawingMode(false)
    setDraftZonePoints([])
    notifyAdminSessionChanged()
    void clearAdminSession()
    if (isSupabaseAdmin) void restoreAnonymousSession()
  }, [clearAdminSession, isSupabaseAdmin])

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
      isSupabaseAdmin,
      adminProfile,
      isPanelOpen,
      isLoginOpen,
      zoneDrawingMode,
      draftZonePoints,
      loginWithEmail,
      loginDev,
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
      isSupabaseAdmin,
      adminProfile,
      isPanelOpen,
      isLoginOpen,
      zoneDrawingMode,
      draftZonePoints,
      loginWithEmail,
      loginDev,
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
