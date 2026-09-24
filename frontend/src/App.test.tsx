import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const fetchMock = vi.fn<typeof fetch>()
const response = (result: number) =>
  new Response(JSON.stringify({ result }), { status: 200 })
const number = (value: number) => ({ type: 'number', value })
const operator = (value: string) => ({ type: 'operator', value })
const parenthesis = (value: string) => ({ type: 'parenthesis', value })
const display = () => screen.getByRole('status')
const button = (name: string) => screen.getByRole('button', { name })
function setup() {
  render(<App />)
  return userEvent.setup()
}
function submittedTokens(call = 0) {
  expect(fetchMock.mock.calls[call][0]).toBe('/calculations')
  expect(fetchMock.mock.calls[call][1]?.method).toBe('POST')
  return JSON.parse(fetchMock.mock.calls[call][1]?.body as string).tokens
}
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

describe('calculator acceptance criteria', () => {
  it.each(['/', '/another-route', '/nested/calculator'])(
    'renders Calculator at %s without an API call',
    (path) => {
      window.history.replaceState({}, '', path)
      setup()
      expect(
        screen.getByRole('heading', { name: /Calculator/ }),
      ).toBeInTheDocument()
      expect(display()).toHaveTextContent('0')
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )

  it('enters all supported tokens with controls and sends their original order', async () => {
    fetchMock.mockResolvedValue(response(123))
    const user = setup()
    for (const name of [
      'Open parenthesis',
      '2',
      'Decimal point',
      '5',
      'Add',
      '3',
      'Close parenthesis',
      'Multiply',
      '4',
      'Divide',
      '2',
      'Subtract',
      '1',
    ])
      await user.click(button(name))
    expect(display()).toHaveTextContent('( 2.5 + 3 ) × 4 ÷ 2 - 1')
    await user.click(button('Equals'))
    expect(
      await screen.findByRole('status', { name: 'Result' }),
    ).toHaveTextContent('123')
    expect(submittedTokens()).toEqual([
      parenthesis('('),
      number(2.5),
      operator('+'),
      number(3),
      parenthesis(')'),
      operator('*'),
      number(4),
      operator('/'),
      number(2),
      operator('-'),
      number(1),
    ])
    // Intentionally different from arithmetic: the frontend must trust the backend.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('accepts keyboard numbers, decimals, all operators, parentheses and Enter', async () => {
    fetchMock.mockResolvedValue(response(11))
    const user = setup()
    await user.keyboard('(2.50+3)*4/2-0{Enter}')
    expect(
      await screen.findByRole('status', { name: 'Result' }),
    ).toHaveTextContent('11')
    expect(submittedTokens()).toEqual([
      parenthesis('('),
      number(2.5),
      operator('+'),
      number(3),
      parenthesis(')'),
      operator('*'),
      number(4),
      operator('/'),
      number(2),
      operator('-'),
      number(0),
    ])
    expect(screen.getByText('( 2.50 + 3 ) × 4 ÷ 2 - 0 =')).toBeInTheDocument()
  })

  it('accepts equals and the displayed multiplication/division symbols from the keyboard', async () => {
    fetchMock.mockResolvedValue(response(4))
    const user = setup()
    await user.keyboard('2×4÷2=')
    expect(
      await screen.findByRole('status', { name: 'Result' }),
    ).toHaveTextContent('4')
    expect(submittedTokens()).toEqual([
      number(2),
      operator('*'),
      number(4),
      operator('/'),
      number(2),
    ])
  })

  it.each([
    ['2+{Enter}', 'Finish the expression'],
    ['(){Enter}', 'Finish the expression'],
    [')', 'no opening parenthesis'],
    ['(2+3{Enter}', 'Close the open parentheses'],
    ['{Enter}', 'Finish the expression'],
    ['2+*', 'Enter a number before this operator'],
    ['2(', 'Add an operator before opening'],
    ['(2)3', 'Add an operator before the next number'],
    ['-{Enter}', 'Finish the expression'],
  ])(
    'handles incomplete or invalid input %s without sending it',
    async (input, message) => {
      const user = setup()
      await user.keyboard(input)
      expect(screen.getByRole('alert')).toHaveTextContent(message)
      expect(fetchMock).not.toHaveBeenCalled()
      await user.keyboard('7')
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(display()).toHaveTextContent(/^7$/)
    },
  )

  it('rejects an empty pair of parentheses immediately', async () => {
    const user = setup()
    await user.keyboard('()')
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a number before closing',
    )
    expect(display()).toHaveTextContent(/^\($/)
  })

  it('backspaces one digit or token using either input method', async () => {
    const user = setup()
    await user.keyboard('(12.3+4)')
    await user.click(button('Backspace'))
    expect(display()).toHaveTextContent('( 12.3 + 4')
    await user.keyboard('{Backspace}{Backspace}{Backspace}')
    expect(display()).toHaveTextContent('( 12.')
    await user.keyboard('{Backspace}{Backspace}')
    expect(display()).toHaveTextContent('( 1')
  })

  it('handles decimal entry and ignores a repeated decimal', async () => {
    const user = setup()
    await user.keyboard('.5.0')
    expect(display()).toHaveTextContent(/^0.50$/)
  })

  it('toggles the current number positive and negative and supports keyboard sign control', async () => {
    fetchMock.mockResolvedValue(response(-2))
    const user = setup()
    await user.keyboard('2')
    await user.click(button('Toggle sign'))
    expect(display()).toHaveTextContent(/^-2$/)
    await user.click(button('Toggle sign'))
    expect(display()).toHaveTextContent(/^2$/)
    await user.keyboard('{F9}=')
    await screen.findByRole('status', { name: 'Result' })
    expect(submittedTokens()).toEqual([number(-2)])
  })

  it('allows negative operands from the keyboard and sign before a number', async () => {
    fetchMock.mockResolvedValue(response(-1))
    const user = setup()
    await user.click(button('Toggle sign'))
    await user.keyboard('.5+-0.5=')
    await screen.findByRole('status', { name: 'Result' })
    expect(submittedTokens()).toEqual([
      number(-0.5),
      operator('+'),
      number(-0.5),
    ])
  })

  it.each([
    ['invalid_tokens', 400, 'expression is incomplete or invalid'],
    ['division_by_zero', 422, 'Cannot divide by zero'],
    ['non_finite_result', 422, 'result is too large'],
    ['unknown', 500, 'Something went wrong'],
  ])(
    'shows %s in the screen and starts fresh on number input',
    async (code, status, message) => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code, message: 'internal detail' } }),
          { status },
        ),
      )
      const user = setup()
      await user.keyboard('8/0{Enter}')
      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent(message)
      expect(alert.closest('.screen')).not.toBeNull()
      await user.keyboard('3')
      expect(display()).toHaveTextContent(/^3$/)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    },
  )

  it('allows correction with backspace after a backend error', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'division_by_zero' } }), {
          status: 422,
        }),
      )
      .mockResolvedValueOnce(response(4))
    const user = setup()
    await user.keyboard('8/0{Enter}')
    await screen.findByRole('alert')
    await user.keyboard('{Backspace}2{Enter}')
    expect(
      await screen.findByRole('status', { name: 'Result' }),
    ).toHaveTextContent('4')
    expect(submittedTokens(1)).toEqual([number(8), operator('/'), number(2)])
  })

  it('handles network failure in the display', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const user = setup()
    await user.keyboard('1{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot reach the calculator service',
    )
    await user.click(button('Clear calculator and history'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(display()).toHaveTextContent(/^0$/)
  })

  it.each(['not json', '{}', '{"result":null}'])(
    'handles malformed service responses (%s)',
    async (body) => {
      fetchMock.mockResolvedValue(new Response(body, { status: 200 }))
      const user = setup()
      await user.keyboard('1=')
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'invalid result',
      )
    },
  )

  it('continues from the returned result with an operator and starts fresh with a number', async () => {
    fetchMock
      .mockResolvedValueOnce(response(12))
      .mockResolvedValueOnce(response(24))
    const user = setup()
    await user.keyboard('2+2*5{Enter}')
    await screen.findByRole('status', { name: 'Result' })
    await user.keyboard('*2=')
    await waitFor(() => expect(display()).toHaveTextContent(/^24$/))
    expect(submittedTokens(1)).toEqual([number(12), operator('*'), number(2)])
    await user.keyboard('7')
    expect(display()).toHaveTextContent(/^7$/)
    expect(screen.getByText('12 × 2 = 24')).toBeInTheDocument()
  })

  it('shows collapsible successful history; Clear erases history, result and expression', async () => {
    fetchMock
      .mockResolvedValueOnce(response(5))
      .mockResolvedValueOnce(response(10))
    const user = setup()
    await user.keyboard('2+3=')
    await screen.findByRole('status', { name: 'Result' })
    await user.keyboard('*2=')
    await waitFor(() => expect(display()).toHaveTextContent(/^10$/))
    const toggle = button('Calculation history')
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const history = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(within(history).getAllByRole('listitem')).toHaveLength(2)
    expect(history).toHaveTextContent('2 + 3= 5')
    expect(history).toHaveTextContent('5 × 2= 10')
    await user.click(button('Clear calculator and history'))
    expect(display()).toHaveTextContent(/^0$/)
    expect(
      screen.queryByRole('status', { name: 'Result' }),
    ).not.toBeInTheDocument()
    expect(within(history).queryAllByRole('listitem')).toHaveLength(0)
    expect(history).toHaveTextContent('A clean slate')
    await user.click(toggle)
    expect(history).not.toBeVisible()
  })

  it('keeps successful history when an error is replaced by a new number, until Clear', async () => {
    fetchMock
      .mockResolvedValueOnce(response(2))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { code: 'division_by_zero' } }), {
          status: 422,
        }),
      )
    const user = setup()
    await user.keyboard('1+1=')
    await screen.findByRole('status', { name: 'Result' })
    await user.keyboard('/0=')
    await screen.findByRole('alert')
    await user.keyboard('.5')
    expect(display()).toHaveTextContent(/^0.5$/)
    await user.click(button('Calculation history'))
    expect(
      screen
        .getAllByRole('listitem')
        .filter((item) => item.closest('.history-panel')),
    ).toHaveLength(1)
    await user.keyboard('{Escape}')
    expect(
      screen.getByText('A clean slate. Your answers will live here.'),
    ).toBeVisible()
  })

  it('has accessible controls and can navigate, activate and calculate with only a keyboard', async () => {
    const user = setup()
    for (const control of screen.getAllByRole('button'))
      expect(control).toHaveAccessibleName()
    await user.tab()
    expect(button('Calculation history')).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(button('Calculation history')).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await user.tab()
    expect(button('Clear calculator and history')).toHaveFocus()
    await user.keyboard(' ')
    for (let i = 0; i < 4; i++) await user.tab()
    expect(button('7')).toHaveFocus()
    await user.keyboard(' ')
    expect(display()).toHaveTextContent(/^7$/)
    await user.keyboard('{Enter}')
    expect(display()).toHaveTextContent(/^77$/)
    fetchMock.mockResolvedValue(response(77))
    button('Equals').focus()
    await user.keyboard('{Enter}')
    expect(
      await screen.findByRole('status', { name: 'Result' }),
    ).toHaveTextContent('77')
  })

  it('blocks duplicate submission and ignores late responses after Clear', async () => {
    let resolve!: (value: Response) => void
    fetchMock.mockImplementation(
      () =>
        new Promise<Response>((done) => {
          resolve = done
        }),
    )
    const user = setup()
    await user.keyboard('1+2{Enter}{Enter}')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(button('Equals')).toHaveAttribute('aria-disabled', 'true')
    await user.keyboard('9')
    expect(display()).toHaveTextContent('1 + 2')
    const signal = fetchMock.mock.calls[0][1]?.signal
    await user.click(button('Clear calculator and history'))
    expect(signal?.aborted).toBe(true)
    await act(async () => {
      resolve(response(3))
    })
    expect(display()).toHaveTextContent(/^0$/)
    expect(button('Calculation history')).toHaveTextContent('0')
  })
})
