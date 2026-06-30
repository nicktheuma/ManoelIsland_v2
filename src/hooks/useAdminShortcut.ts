import { useEffect } from 'react'
import { useAdmin } from '../context/AdminProvider'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function useAdminShortcut() {
  const { isAdmin, openLogin, togglePanel } = useAdmin()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'p') return
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      if (isEditableTarget(event.target)) return

      event.preventDefault()
      if (isAdmin) togglePanel()
      else openLogin()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isAdmin, openLogin, togglePanel])
}
