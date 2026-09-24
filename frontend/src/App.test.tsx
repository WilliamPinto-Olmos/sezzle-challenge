import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import App from './App'

it('renders without requesting API health', () => {
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Sezzle Challenge' })).toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
  vi.unstubAllGlobals()
})
