import { useState, useEffect, useCallback } from 'react'

const api = {
  fetch: (): Promise<string[]> => Promise.resolve([]),
}

export function Test() {
  const [items, setItems] = useState<string[]>([])

  const load = useCallback(async () => {
    const res = await api.fetch()
    setItems(res)
  }, [])

  useEffect(() => {
    const t = window.setTimeout(load, 0)
    return () => window.clearTimeout(t)
  }, [load])

  return <div>{items.length}</div>
}
