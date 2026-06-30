import { useEffect, useRef, useState } from 'react'
import {
  loadAdminPanelScroll,
  loadAdminPanelSections,
  saveAdminPanelScroll,
  saveAdminPanelSections,
  type AdminPanelSectionId,
  type AdminPanelSectionState,
} from '../utils/adminPanelSections'

export function useAdminPanelLayout(isPanelOpen: boolean) {
  const [sections, setSections] = useState(loadAdminPanelSections)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    saveAdminPanelSections(sections)
  }, [sections])

  useEffect(() => {
    if (!isPanelOpen) return

    const node = scrollRef.current
    if (!node) return

    requestAnimationFrame(() => {
      node.scrollTop = loadAdminPanelScroll()
    })

    const onScroll = () => saveAdminPanelScroll(node.scrollTop)
    node.addEventListener('scroll', onScroll, { passive: true })
    return () => node.removeEventListener('scroll', onScroll)
  }, [isPanelOpen])

  const toggleSection = (id: AdminPanelSectionId) => {
    setSections((previous) => ({ ...previous, [id]: !previous[id] }))
  }

  const isExpanded = (id: AdminPanelSectionId) => sections[id]

  return { scrollRef, toggleSection, isExpanded }
}

export type { AdminPanelSectionId, AdminPanelSectionState }
