import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import * as Calculator from './Calculator'

function Fixture() {
  return (
    <Calculator.Root>
      <Calculator.HistoryToggle />
      <Calculator.Display />
      <Calculator.History />
      <Calculator.Keypad>
        <Calculator.Key value="clear" color="coral" aria-label="Clear">C</Calculator.Key>
        <Calculator.Key value="backspace" color="coral" aria-label="Backspace">⌫</Calculator.Key>
        <Calculator.Key value="7" color="paper" aria-label="7">7</Calculator.Key>
      </Calculator.Keypad>
    </Calculator.Root>
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it('activates focused Clear and Backspace with Enter without submitting', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  render(<Fixture />)
  const user = userEvent.setup()
  await user.keyboard('123')
  screen.getByRole('button', { name: 'Backspace' }).focus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('status')).toHaveTextContent(/^12$/)
  screen.getByRole('button', { name: 'Clear' }).focus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('status')).toHaveTextContent(/^0$/)
  expect(fetchMock).not.toHaveBeenCalled()
})

it('isolates keyboard input and history disclosure between instances', async () => {
  render(<><Fixture /><Fixture /></>)
  const user = userEvent.setup()
  const [first, second] = screen.getAllByRole('region', { name: 'Calculator' })
  await user.keyboard('9')
  expect(within(first).getByRole('status')).toHaveTextContent(/^0$/)
  expect(within(second).getByRole('status')).toHaveTextContent(/^0$/)
  first.focus()
  await user.keyboard('12')
  second.focus()
  await user.keyboard('34')
  expect(within(first).getByRole('status')).toHaveTextContent(/^12$/)
  expect(within(second).getByRole('status')).toHaveTextContent(/^34$/)

  const firstToggle = within(first).getByRole('button', { name: 'Calculation history' })
  const secondToggle = within(second).getByRole('button', { name: 'Calculation history' })
  const firstId = firstToggle.getAttribute('aria-controls')!
  const secondId = secondToggle.getAttribute('aria-controls')!
  expect(firstId).not.toBe(secondId)
  expect(first).toContainElement(document.getElementById(firstId))
  expect(second).toContainElement(document.getElementById(secondId))
  await user.click(firstToggle)
  expect(document.getElementById(firstId)).toBeVisible()
  expect(document.getElementById(secondId)).not.toBeVisible()
})

it('leaves unrelated controls and editable fields alone', async () => {
  const activate = vi.fn()
  render(<><Fixture /><button onClick={activate}>Other action</button><input aria-label="Notes" /></>)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Other action' }))
  await user.keyboard('12{Enter}')
  expect(activate).toHaveBeenCalledTimes(2)
  await user.type(screen.getByRole('textbox'), '34')
  expect(screen.getByRole('textbox')).toHaveValue('34')
  expect(screen.getByRole('status')).toHaveTextContent(/^0$/)
})

it('explains when a part is rendered outside Root', () => {
  expect(() => render(<Calculator.Display />)).toThrow('Calculator parts must be rendered inside Calculator.Root')
})
