import { useEffect } from 'react'
import type { RefObject } from 'react'
import type { CalculatorKey } from './keys'

const aliases: Record<string, CalculatorKey> = {
  Enter: '=', Backspace: 'backspace', Escape: 'clear', Delete: 'clear',
  '×': '*', '÷': '/', F9: 'sign',
}

export function useCalculatorKeyboard(
  root: RefObject<HTMLElement | null>,
  input: (key: CalculatorKey) => void,
) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
      const target = event.target
      if (!(target instanceof HTMLElement) || !root.current) return
      if (target.isContentEditable || target.closest('input, textarea, select')) return
      if (event.key === 'Enter' && target.closest('button, a[href], [role="button"]')) return

      // Allow typing immediately on the standalone page. With multiple calculators,
      // focus identifies the owner; unrelated controls never route shortcuts here.
      const owner = target.closest('[data-calculator-root]')
      const standalone = (target === document.body || target === document.documentElement)
        && document.querySelectorAll('[data-calculator-root]').length === 1
      if (owner !== root.current && !standalone) return

      const key = aliases[event.key] ?? event.key
      if (!/^[\d.+\-*/()=]$/.test(key) && !['clear', 'backspace', 'sign'].includes(key)) return
      event.preventDefault()
      input(key as CalculatorKey)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [root, input])
}
