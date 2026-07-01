import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeSceneAppearance } from '../config/sceneAppearance'
import type { SceneAppearance } from '../types/sandbox'

const SCENE_COMMIT_MS = 300
const SCENE_SYNC_MS = 1000

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
  const commitTimerRef = useRef<number | null>(null)
  const syncTimerRef = useRef<number | null>(null)
  const latestDraftRef = useRef(draft)
  const isCommittingRef = useRef(false)

  latestDraftRef.current = draft

  useEffect(() => {
    if (isCommittingRef.current) return
    setDraft(normalizeSceneAppearance(committed))
  }, [committed])

  useEffect(
    () => () => {
      if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current)
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
    },
    [],
  )

  const flushToSandbox = useCallback(
    (next: SceneAppearance) => {
      const normalized = normalizeSceneAppearance(next)
      isCommittingRef.current = true
      patchSettings({ sceneAppearance: normalized })
      window.requestAnimationFrame(() => {
        isCommittingRef.current = false
      })

      if (!isMultiplayer) {
        onLocalMessage?.('Scene settings saved locally.')
        return
      }

      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current)
      syncTimerRef.current = window.setTimeout(() => {
        onSyncStart?.()
        void syncSceneAppearanceSettings(normalized, getAdminPassword()).then((result) => {
          onSyncEnd?.(result.ok ? 'Scene applied for all visitors.' : result.message)
        })
      }, SCENE_SYNC_MS)
    },
    [
      getAdminPassword,
      isMultiplayer,
      onLocalMessage,
      onSyncEnd,
      onSyncStart,
      patchSettings,
      syncSceneAppearanceSettings,
    ],
  )

  const applySceneAppearance = useCallback(
    (next: SceneAppearance, options?: { immediate?: boolean }) => {
      const normalized = normalizeSceneAppearance(next)
      setDraft(normalized)
      latestDraftRef.current = normalized

      if (commitTimerRef.current) window.clearTimeout(commitTimerRef.current)

      if (options?.immediate) {
        flushToSandbox(normalized)
        return
      }

      commitTimerRef.current = window.setTimeout(() => {
        commitTimerRef.current = null
        flushToSandbox(latestDraftRef.current)
      }, SCENE_COMMIT_MS)
    },
    [flushToSandbox],
  )

  return { sceneAppearance: draft, applySceneAppearance }
}
