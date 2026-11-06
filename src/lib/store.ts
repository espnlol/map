import { useSyncExternalStore } from 'react'

/** A tiny persisted store: state lives in localStorage and React re-renders on change. */
export function createStore<T>(key: string, initial: T) {
  let state: T = initial
  try {
    const raw = localStorage.getItem(key)
    if (raw) state = JSON.parse(raw) as T
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  const listeners = new Set<() => void>()
  const get = () => state
  const set = (next: T | ((prev: T) => T)) => {
    state = typeof next === 'function' ? (next as (p: T) => T)(state) : next
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* full or unavailable: keep it in memory */
    }
    listeners.forEach((l) => l())
  }
  const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => listeners.delete(l)
  }
  const use = () => useSyncExternalStore(subscribe, get, get)
  return { get, set, use, subscribe }
}
