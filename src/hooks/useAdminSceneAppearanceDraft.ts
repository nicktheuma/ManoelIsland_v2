import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeSceneAppearance } from '../config/sceneAppearance'
import type { SceneAppearance } from '../types/sandbox'

const SCENE_SYNC_MS = 1000
/** Debounce live sandbox updates while dragging admin sliders. */
const SANDBOX_COMMIT_MS = 250

type UseAdminSceneAppearanceDraftOptions = {
  committed: SceneAppearance
  patchSettings: (patch: { sceneAppearance: SceneAppearance }) => void
  syncSceneAppearanceSettings: (
    sceneAppearance: SceneAppearance,
    adminPassword: string,
  ) => Promise<{ ok: true } | { ok: false; message: string }>
  isMultiplayer: boolean
  getAdminPassword: () => string
  onLocalMessage?: (message: string) => void
  onSyncStart?: () => void
  onSyncEnd?: (message: string | null) => void
}

export function useAdminSceneAppearanceDraft({
  committed,
  patchSettings,
  syncSceneAppearanceSettings,
  isMultiplayer,
  getAdminPassword,
  onLocalMessage,
  onSyncStart,
  onSyncEnd,
}: UseAdminSceneAppearanceDraftOptions) {
  const [draft, setDraft] = useState(() => normalizeSceneAppearance(committed))
  const syncTimerRef = useRef<number | null>(null)
  const sandboxCommitTimerRef = useRef<number | null>(null)
  const latestDraftRef = useRef(draft)
  const isCommittingRef = useRef(false)

  latestDraftRef.current = draft

  useEffect(() => {
    if (isCommittingRef.current) return
    if (syncTimerRef.current !== null) return
    setDraft(normalizeSceneAppearance(committed))
  }, [committed])

  useEffect(
    () => () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
      if (sandboxCommitTimerRef.current) window.clearTimeout(sandboxCommitTimerRef.current)
    },
    [],
  )

  const applyToSandbox = useCallback(
    (normalized: SceneAppearance, immediate: boolean) => {
      if (sandboxCommitTimerRef.current) window.clearTimeout(sandboxCommitTimerRef.current)

      const commit = () => {
        sandboxCommitTimerRef.current = null
        isCommittingRef.current = true
        patchSettings({ sceneAppearance: normalized })
        window.requestAnimationFrame(() => {
          isCommittingRef.current = false
        })
      }

      if (immediate) {
        commit()
        return
      }

      sandboxCommitTimerRef.current = window.setTimeout(commit, SANDBOX_COMMIT_MS)
    },
    [patchSettings],
  )

  const scheduleServerSync = useCallback(
    (normalized: SceneAppearance, immediate: boolean) => {
      if (!isMultiplayer) {
        onLocalMessage?.('Scene settings saved locally.')
        return
      }

      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
      syncTimerRef.current = window.setTimeout(() => {
        syncTimerRef.current = null
        onSyncStart?.()
        void syncSceneAppearanceSettings(normalized, getAdminPassword()).then((result) => {
          onSyncEnd?.(result.ok ? 'Scene applied for all visitors.' : result.message)
        })
      }, immediate ? 0 : SCENE_SYNC_MS)
    },
    [getAdminPassword, isMultiplayer, onLocalMessage, onSyncEnd, onSyncStart, syncSceneAppearanceSettings],
  )

  const applySceneAppearance = useCallback(
    (next: SceneAppearance, options?: { immediate?: boolean }) => {
      const normalized = normalizeSceneAppearance(next)
      setDraft(normalized)
      latestDraftRef.current = normalized
      applyToSandbox(normalized, options?.immediate ?? false)
      scheduleServerSync(normalized, options?.immediate ?? false)
    },
    [applyToSandbox, scheduleServerSync],
  )

  return { sceneAppearance: draft, applySceneAppearance }
}
