import { useCallback, useEffect, useReducer, useState } from 'react'
import { calculate } from './api'
import { initialState, reducer } from './state'
import type { CalculatorKey } from './keys'

export function useCalculator() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [pressed, setPressed] = useState<{ key: string; count: number } | null>(
    null,
  )
  const input = useCallback((key: CalculatorKey) => {
    dispatch({ type: 'input', key })
    setPressed((previous) => ({ key, count: (previous?.count ?? 0) + 1 }))
  }, [])

  useEffect(() => {
    const request = state.pending
    if (!request) return
    const controller = new AbortController()
    calculate(request.tokens, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted)
          dispatch({ type: 'success', request, result })
      },
      (error) => {
        if (!controller.signal.aborted)
          dispatch({ type: 'failure', request, message: error.message })
      },
    )
    return () => controller.abort()
  }, [state.pending])

  return { state, input, pressed }
}
