import { useEffect, useState } from 'react'
import { ADMIN_SESSION_KEY } from '../config/defaults'

export function useLocalAdminActive(): boolean {
  const [isAdmin, setIsAdmin] = useState(
    () => typeof sessionStorage !== 'undefined' && sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true',
  )

  useEffect(() => {
    const sync = () => {
      setIsAdmin(sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true')
    }

    window.addEventListener('manoel-admin-changed', sync)
    return () => window.removeEventListener('manoel-admin-changed', sync)
  }, [])

  return isAdmin
}

export function notifyAdminSessionChanged(): void {
  window.dispatchEvent(new Event('manoel-admin-changed'))
}
