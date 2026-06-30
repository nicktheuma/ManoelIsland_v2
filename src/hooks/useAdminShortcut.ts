import { useEffect } from 'react'
import { useAdmin } from '../context/AdminProvider'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

function openAdminGateway(isAdmin: boolean, openLogin: () => void, togglePanel: () => void) {
  if (isAdmin) togglePanel()
  else openLogin()
}

export function useAdminShortcut() {
  const { isAdmin, openLogin, togglePanel } = useAdmin()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      const ctrlOrMeta = event.ctrlKey || event.metaKey
      const isCtrlShiftA =
        ctrlOrMeta && event.shiftKey && event.key.toLowerCase() === 'a'
      const isP =
        event.key.toLowerCase() === 'p' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey

      if (!isCtrlShiftA && !isP) return

      event.preventDefault()
      openAdminGateway(isAdmin, openLogin, togglePanel)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAdmin, openLogin, togglePanel])
}
