import { useState, useEffect } from 'react'
import { initPyodide, isPyodideReady } from '../../shared/pyodide'

export function usePyodideState({ lesson }) {
  const [pyodideStatus, setPyodideStatus] = useState('idle')

  useEffect(() => {
    if (!lesson || lesson.type !== 'python' || isPyodideReady()) return
    setPyodideStatus('loading')
    initPyodide(msg => setPyodideStatus(msg))
      .then(() => setPyodideStatus('ready'))
      .catch(() => setPyodideStatus('error'))
  }, [lesson])

  async function initPyodideIfNeeded() {
    if (!isPyodideReady()) {
      setPyodideStatus('loading')
      await initPyodide()
      setPyodideStatus('ready')
    }
  }

  return { pyodideStatus, setPyodideStatus, initPyodideIfNeeded }
}
