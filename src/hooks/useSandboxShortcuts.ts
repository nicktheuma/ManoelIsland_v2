import { useEffect } from 'react'
import { useSandbox } from '../context/SandboxProvider'

export function useSandboxShortcuts() {
  const { undo, redo, deleteSelected, selectedPropId, selectProp } = useSandbox()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedPropId) {
        event.preventDefault()
        deleteSelected()
      }

      if (event.key === 'Escape') {
        selectProp(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, deleteSelected, selectedPropId, selectProp])
}
