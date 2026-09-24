import { createContext, useContext, useId, useRef, useState } from 'react'
import type { Dispatch, PropsWithChildren, SetStateAction } from 'react'
import { expression } from './state'
import type { CalculatorKey, KeyColor } from './keys'
import { useCalculator } from './useCalculator'
import { useCalculatorKeyboard } from './useCalculatorKeyboard'

type CalculatorContextValue = ReturnType<typeof useCalculator> & {
  historyOpen: boolean
  setHistoryOpen: Dispatch<SetStateAction<boolean>>
  historyId: string
}
const CalculatorContext = createContext<CalculatorContextValue | null>(null)

function useCalculatorContext() {
  const context = useContext(CalculatorContext)
  if (!context) throw new Error('Calculator parts must be rendered inside Calculator.Root')
  return context
}

export function Root({ children }: PropsWithChildren) {
  const calculator = useCalculator()
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyId = useId()
  const root = useRef<HTMLElement>(null)
  useCalculatorKeyboard(root, calculator.input)
  return (
    <CalculatorContext.Provider value={{ ...calculator, historyOpen, setHistoryOpen, historyId }}>
      <section ref={root} className="calculator" aria-label="Calculator" data-calculator-root tabIndex={-1}>
        {children}
      </section>
    </CalculatorContext.Provider>
  )
}

export function Screen({ children }: PropsWithChildren) {
  const { state } = useCalculatorContext()
  return (
    <div className={`screen ${state.error ? 'screen-error' : ''}`} aria-busy={Boolean(state.pending)}>
      {children}
    </div>
  )
}

export function HistoryToggle() {
  const { state, historyOpen, setHistoryOpen, historyId } = useCalculatorContext()
  return (
    <button
      className="history-toggle"
      type="button"
      aria-label="Calculation history"
      aria-expanded={historyOpen}
      aria-controls={historyId}
      onClick={() => setHistoryOpen((open) => !open)}
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 10a9 9 0 1 1 1 7M3 4v6h6M12 7v5l3 2" />
      </svg>
      History{' '}
      <span className="history-count">{state.history.length}</span>
      <span aria-hidden="true">{historyOpen ? '−' : '+'}</span>
    </button>
  )
}

export function Status() {
  const { state } = useCalculatorContext()
  return (
    <span className="screen-status">
      {state.pending
        ? 'calculating…'
        : state.error
          ? 'try again'
          : state.result !== null
            ? 'equals'
            : ''}
    </span>
  )
}

export function Display() {
  const { state } = useCalculatorContext()
  const current = expression(state.entries)
  const latest = state.history.at(-1)
  return (
    <div
      key={state.clearCount}
      className={
        state.clearCount ? 'display-content cleared' : 'display-content'
      }
    >
      <p className="previous">
        {state.result !== null
          ? `${current} =`
          : latest
            ? `${latest.expression} = ${latest.result}`
            : 'Enter an expression to calculate'}
      </p>
      <div
        className="readout"
        role="status"
        aria-label={state.result !== null ? 'Result' : 'Expression'}
        aria-live="polite"
        aria-atomic="true"
      >
        {state.result !== null ? String(state.result) : current || '0'}
      </div>
      {state.error && (
        <div className="error-message" role="alert">
          <strong>{state.error}</strong>
          <span>Type a new number to start over, or press Clear.</span>
        </div>
      )}
    </div>
  )
}

export function History() {
  const { state, historyOpen, historyId } = useCalculatorContext()
  return (
    <div
      id={historyId}
      className="history-panel"
      hidden={!historyOpen}
    >
      <div className="history-heading">
        <h2>Your calculations</h2>
        <span>since last clear</span>
      </div>
      {state.history.length === 0 ? (
        <p className="history-empty">
          A clean slate. Your answers will live here.
        </p>
      ) : (
        <ol>
          {state.history.map((item, index) => (
            <li key={index}>
              <span>{item.expression}</span>
              <strong>= {item.result}</strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function Keypad({ children }: PropsWithChildren) {
  useCalculatorContext()
  return <div className="keypad" aria-label="Calculator controls">{children}</div>
}

type KeyProps = PropsWithChildren<{
  value: CalculatorKey
  color: KeyColor
  'aria-label': string
}>
export function Key({ value, color, 'aria-label': name, children }: KeyProps) {
  const { state, input, pressed } = useCalculatorContext()
  return (
    <button
      type="button"
      aria-label={name}
      aria-disabled={Boolean(state.pending) && value !== 'clear'}
      className={`key key-${color} ${value === '=' ? 'key-equals' : ''}`}
      onClick={() => input(value)}
    >
      <span
        key={pressed?.key === value ? pressed.count : 'idle'}
        className={pressed?.key === value ? 'key-pressed' : ''}
      >
        {children}
      </span>
    </button>
  )
}

