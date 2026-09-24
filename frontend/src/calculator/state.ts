import type { Token } from './api'

// Numbers stay as entered strings until submission, preserving e.g. "0.50".
export type Entry = { type: Token['type']; value: string }
type Calculation = { expression: string; result: number }
type Request = { tokens: Token[]; expression: string }
export type State = {
  entries: Entry[]
  result: number | null
  error: string | null
  history: Calculation[]
  pending: Request | null
  clearCount: number
}
export const initialState: State = {
  entries: [],
  result: null,
  error: null,
  history: [],
  pending: null,
  clearCount: 0,
}
export type Action =
  | { type: 'input'; key: string }
  | { type: 'success'; request: Request; result: number }
  | { type: 'failure'; request: Request; message: string }

export function expression(entries: Entry[]) {
  return entries
    .map(({ value }) => (value === '*' ? '×' : value === '/' ? '÷' : value))
    .join(' ')
}

export function reducer(state: State, action: Action): State {
  if (action.type === 'success') {
    if (state.pending !== action.request) return state
    return {
      ...state,
      pending: null,
      result: action.result,
      error: null,
      history: [
        ...state.history,
        { expression: action.request.expression, result: action.result },
      ],
    }
  }
  if (action.type === 'failure') {
    return state.pending !== action.request
      ? state
      : { ...state, pending: null, error: action.message }
  }
  const key = action.key
  if (key === 'clear')
    return { ...initialState, clearCount: state.clearCount + 1 }
  if (state.pending) return state

  let entries = [...state.entries]
  const numeric = /^\d$/.test(key) || key === '.'
  if ((state.result !== null || state.error) && numeric) entries = []
  else if (state.result !== null)
    entries = [{ type: 'number', value: String(state.result) }]
  const last = entries.at(-1)
  const expectsNumber = !last || last.type === 'operator' || last.value === '('
  const balance = entries.reduce(
    (count, item) =>
      count + (item.value === '(' ? 1 : item.value === ')' ? -1 : 0),
    0,
  )
  const update = (next: Entry[]) => ({
    ...state,
    entries: next,
    result: null,
    error: null,
  })
  const error = (message: string) => ({ ...state, error: message })
  const replaceLast = (value: string) =>
    update([...entries.slice(0, -1), { type: 'number', value }])

  if (numeric) {
    if (last?.value === ')')
      return error('Add an operator before the next number.')
    if (last?.type === 'number') {
      if (key === '.' && last.value.includes('.')) return state
      const value = last.value === '-' && key === '.' ? '-0.' : last.value + key
      return replaceLast(value)
    }
    return update([
      ...entries,
      { type: 'number', value: key === '.' ? '0.' : key },
    ])
  }
  if (key === 'backspace') {
    if (
      last?.type === 'number' &&
      last.value.length > 1 &&
      !last.value.includes('e')
    ) {
      const value = last.value.slice(0, -1)
      return value === '-' ? update(entries.slice(0, -1)) : replaceLast(value)
    }
    return update(entries.slice(0, -1))
  }
  if (key === 'sign') {
    if (last?.type === 'number') {
      if (last.value === '-') return update(entries.slice(0, -1))
      return replaceLast(
        last.value.startsWith('-') ? last.value.slice(1) : `-${last.value}`,
      )
    }
    if (expectsNumber)
      return update([...entries, { type: 'number', value: '-' }])
    return error(
      'The sign button changes a number. Enter an operator to start the next number.',
    )
  }
  if (key === '(') {
    if (!expectsNumber)
      return error('Add an operator before opening a parenthesis.')
    return update([...entries, { type: 'parenthesis', value: '(' }])
  }
  if (key === ')') {
    if (balance === 0) return error('There is no opening parenthesis to close.')
    if (expectsNumber || last?.value === '-')
      return error('Enter a number before closing the parenthesis.')
    return update([...entries, { type: 'parenthesis', value: ')' }])
  }
  if (['+', '-', '*', '/'].includes(key)) {
    // Unary minus is represented as a signed number, as required by the API.
    if (key === '-' && expectsNumber)
      return update([...entries, { type: 'number', value: '-' }])
    if (expectsNumber || last?.value === '-')
      return error('Enter a number before this operator.')
    return update([...entries, { type: 'operator', value: key }])
  }
  if (key === '=') {
    if (state.result !== null) return state
    if (expectsNumber || last?.value === '-')
      return error(
        'Finish the expression with a number or closing parenthesis.',
      )
    if (balance !== 0)
      return error('Close the open parentheses before calculating.')
    const tokens: Token[] = entries.map((item) =>
      item.type === 'number'
        ? { type: 'number', value: Number(item.value) }
        : { type: item.type, value: item.value },
    )
    if (
      tokens.some(
        (token) => token.type === 'number' && !Number.isFinite(token.value),
      )
    ) {
      return error('That number is too large. Try a smaller number.')
    }
    return {
      ...state,
      error: null,
      pending: { tokens, expression: expression(entries) },
    }
  }
  return state
}
