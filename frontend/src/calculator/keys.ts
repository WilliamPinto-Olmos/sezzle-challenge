export type CalculatorKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '.' | '+' | '-' | '*' | '/' | '(' | ')' | '='
  | 'clear' | 'backspace' | 'sign'
export type KeyColor = 'coral' | 'lavender' | 'paper' | 'yellow' | 'mint'

export const keys: { value: CalculatorKey; label: string; name: string; color: KeyColor }[] = [
  { value: 'clear', label: 'C', name: 'Clear calculator and history', color: 'coral' },
  { value: '(', label: '(', name: 'Open parenthesis', color: 'lavender' },
  { value: ')', label: ')', name: 'Close parenthesis', color: 'lavender' },
  { value: 'backspace', label: '⌫', name: 'Backspace', color: 'coral' },
  { value: '7', label: '7', name: '7', color: 'paper' },
  { value: '8', label: '8', name: '8', color: 'paper' },
  { value: '9', label: '9', name: '9', color: 'paper' },
  { value: '/', label: '÷', name: 'Divide', color: 'yellow' },
  { value: '4', label: '4', name: '4', color: 'paper' },
  { value: '5', label: '5', name: '5', color: 'paper' },
  { value: '6', label: '6', name: '6', color: 'paper' },
  { value: '*', label: '×', name: 'Multiply', color: 'yellow' },
  { value: '1', label: '1', name: '1', color: 'paper' },
  { value: '2', label: '2', name: '2', color: 'paper' },
  { value: '3', label: '3', name: '3', color: 'paper' },
  { value: '-', label: '−', name: 'Subtract', color: 'yellow' },
  { value: 'sign', label: '±', name: 'Toggle sign', color: 'lavender' },
  { value: '0', label: '0', name: '0', color: 'paper' },
  { value: '.', label: '.', name: 'Decimal point', color: 'paper' },
  { value: '+', label: '+', name: 'Add', color: 'yellow' },
  { value: '=', label: '=', name: 'Equals', color: 'mint' },
]
