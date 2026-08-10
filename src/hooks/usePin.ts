import { useCallback, useEffect, useState } from 'react'
import { generateSalt, hashPin, verifyPin } from '../lib/pin'
import { getSetting, setSetting } from '../db/repo'

const SALT_KEY = 'pin_salt'
const HASH_KEY = 'pin_hash'

export function usePin() {
  const [enabled, setEnabled] = useState(false)
  const [locked, setLocked] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const refresh = async () => {
      const hash = await getSetting<string>(HASH_KEY)
      setEnabled(!!hash)
      setLocked(!!hash)
      setReady(true)
    }
    refresh()
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(async () => {
          const hash = await getSetting<string>(HASH_KEY)
          if (hash) setLocked(true)
        }, 60000)
      } else if (timer) {
        clearTimeout(timer)
        timer = null
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const setup = useCallback(async (pin: string) => {
    const salt = generateSalt()
    const hash = await hashPin(pin, salt)
    await setSetting(SALT_KEY, salt)
    await setSetting(HASH_KEY, hash)
    setEnabled(true)
    setLocked(false)
  }, [])

  const unlock = useCallback(async (pin: string) => {
    const salt = await getSetting<string>(SALT_KEY)
    const hash = await getSetting<string>(HASH_KEY)
    if (!salt || !hash) return false
    const ok = await verifyPin(pin, salt, hash)
    if (ok) setLocked(false)
    return ok
  }, [])

  const change = useCallback(async (oldPin: string, newPin: string) => {
    const ok = await unlock(oldPin)
    if (!ok) return false
    await setup(newPin)
    return true
  }, [unlock, setup])

  const disable = useCallback(async (oldPin: string) => {
    const ok = await unlock(oldPin)
    if (!ok) return false
    await setSetting(HASH_KEY, undefined)
    await setSetting(SALT_KEY, undefined)
    setEnabled(false)
    return true
  }, [unlock])

  return { enabled, locked, ready, setup, unlock, change, disable }
}
