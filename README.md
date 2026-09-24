# Sezzle Challenge

Full-stack calculator with a React frontend and a Go HTTP service. Supports addition, subtraction, multiplication, division, decimals, and nested parentheses.

## Requirements

- Go 1.24+
- Node.js 24+ and npm
- Docker with Compose (for container runs)

## Run locally

```sh
npm ci
cd backend && go run .
```

In another terminal, from the repository root:

```sh
npm run dev
```

Open [the calculator](http://localhost:5173). The API runs at `http://localhost:8080`; `GET /health` returns `{"status":"ok"}`.

## Calculator interface

All frontend paths render the same calculator. Type numbers, `.`, `+`, `-`, `*`, `/`, and parentheses, or use the on-screen buttons. `Enter` / `=` calculates, `Backspace` removes the last digit or token, `F9` toggles the current number’s sign, and `Escape` / `Delete` clears. Use `Tab` to navigate and `Space` or `Enter` to activate the focused button. When a button has focus, `Enter` activates it instead of submitting the expression; `=` still calculates.

The frontend preserves the expression’s token order and sends it to the API; only the backend evaluates arithmetic. After a result, an operator continues from that result and a number starts over. Errors appear inside the display. Entering a new number after an error starts fresh; Backspace also allows correction. History contains successful calculations for the current page session, and Clear resets the expression, result, errors, and history.

## Calculations API

`POST /calculations` with `Content-Type: application/json` accepts `{"tokens":[...]}` in entry order. Each token has a `type` and `value`: `number` takes a finite JSON number (including negatives), `operator` takes `+`, `-`, `*`, or `/`, and `parenthesis` takes `(` or `)`. Send tokens, not an expression string.

```sh
curl http://localhost:8080/calculations \
  -H 'Content-Type: application/json' \
  -d '{"tokens":[{"type":"number","value":2},{"type":"operator","value":"+"},{"type":"number","value":3}]}'
# 200: {"result":5}
```

Six examples, shown as expressions for readability; encode each using the token format above:

| Case | Expression | HTTP | Response |
| --- | --- | --- | --- |
| Regular operation | `2 + 3` | 200 | `{"result":5}` |
| Operator precedence | `2 + 2 * 5` | 200 | `{"result":12}` |
| Nested parentheses | `2 * (3 + (4 / 2))` | 200 | `{"result":10}` |
| Signed decimal | `-0.5 - 2` | 200 | `{"result":-2.5}` |
| Incomplete input | `2 +` | 400 | `{"error":{"code":"invalid_tokens","message":"Missing operand"}}` |
| Division by zero | `8 / 0` | 422 | `{"error":{"code":"division_by_zero","message":"Division by zero"}}` |

Other malformed requests return `400` / `invalid_tokens` with a descriptive message. Non-finite calculation results return `422` / `non_finite_result`. All calculation errors use the same `{"error":{"code":"...","message":"..."}}` shape.

## Design decisions and assumptions

- I worked under the assumption that operations with more than one operand had to be supported, including chained operations and nested parentheses.
- I deliberately left support for square roots, exponents, and percentages out because of time, but the structure remains open to supporting them later by extending the controls, token validation, and server parser.
- I chose to keep all arithmetic execution, logic, and rules on the server. For example, the client does not validate division by zero because that would require it to know arithmetic rules. Client validation only checks input structure and finite numeric values; the server validates every request independently.
- **API proxy:** the browser calls the relative URL `/calculations`. Vite forwards it to `http://localhost:8080`, keeping development requests on the same origin without adding CORS configuration. `API_PROXY_TARGET` overrides the destination; Compose uses `http://backend:8080` so requests reach the backend container. A deployed static build needs its host to forward `/calculations` and serve `index.html` for frontend paths; Vite's development proxy is not included in the build.
- **Evaluation:** a Go recursive-descent parser handles parentheses and operator precedence without `eval`. Multiplication and division precede addition and subtraction; operators at the same level associate left to right. Negative values are number tokens, and multiplication must be explicit.
- **Numeric precision and validation:** Go `float64` and JavaScript numbers keep the implementation simple, with normal floating-point rounding limits. The API rejects non-finite values/results, unknown JSON fields, and malformed tokens, and limits request bodies to 1 MiB.
- **Frontend structure:** all frontend paths render `App`, which composes calculator parts through `Calculator.Root` and context. A reducer owns input transitions, while separate hooks handle requests and keyboard input. Number text stays unchanged until submission, preserving entries such as `0.50`.
- **History and requests:** the backend is stateless; successful history stays in memory per calculator instance until Clear or page reload. Requests block duplicate submissions, and cancellation plus stale-response checks prevent a late response from restoring cleared state. Stable API error codes map to readable messages inside the display.
- **Interaction and accessibility:** the layout is mobile-first, with named buttons, visible focus, live result/error announcements, and reduced-motion support. Keyboard handling respects native button activation, editable fields, and separate calculator instances.
- **Testing:** frontend tests cover the acceptance criteria and component isolation with mocked API responses; Go HTTP-handler tests cover token validation, evaluation, and error responses.

## Run with Docker

```sh
docker compose up --build
```

Open [the calculator](http://localhost:5173).

## Checks

```sh
npm test
npm run coverage
npm run build
npm run lint
```

Coverage writes `frontend/coverage/index.html` and `backend/coverage.out`.
