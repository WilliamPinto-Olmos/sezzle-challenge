export type Token =
  | { type: 'number'; value: number }
  | { type: 'operator' | 'parenthesis'; value: string }

const messages: Record<string, string> = {
  invalid_tokens:
    'This expression is incomplete or invalid. Check the numbers and parentheses.',
  division_by_zero: 'Cannot divide by zero. Try a different number.',
  non_finite_result: 'That result is too large. Try smaller numbers.',
}

export async function calculate(
  tokens: Token[],
  signal: AbortSignal,
): Promise<number> {
  let response: Response
  try {
    response = await fetch('/calculations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens }),
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('Cannot reach the calculator service. Please try again.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      messages[data?.error?.code] ?? 'Something went wrong. Please try again.',
    )
  }
  if (typeof data?.result !== 'number' || !Number.isFinite(data.result)) {
    throw new Error(
      'The calculator service returned an invalid result. Please try again.',
    )
  }
  return data.result
}
