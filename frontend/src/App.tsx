import * as Calculator from './calculator/Calculator'
import { keys } from './calculator/keys'

export default function App() {
  return (
    <main className="page">
      <div className="calculator-layout">
        <header className="intro">
          <h1>
            Calculator
          </h1>
          <p className="subtitle">Supports basic arithmetic operations (+, -, *, /).</p>
          <ul className="instructions">
            <li>Tap the keys or type an expression.</li>
            <li>
              <kbd>=</kbd> to solve · <kbd>Esc</kbd> to clear.
            </li>
          </ul>
        </header>
        <Calculator.Root>
          <Calculator.Screen>
            <div className="screen-toolbar">
              <Calculator.HistoryToggle />
              <Calculator.Status />
            </div>
            <Calculator.Display />
          </Calculator.Screen>
          <Calculator.History />
          <Calculator.Keypad>
            {keys.map(({ value, label, name, color }) => (
              <Calculator.Key key={value} value={value} aria-label={name} color={color}>
                {label}
              </Calculator.Key>
            ))}
          </Calculator.Keypad>
        </Calculator.Root>
      </div>
    </main>
  )
}
