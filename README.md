# Sezzle Challenge

Full-stack calculator application with a React frontend and a go microservice. The frontend consumes the backend API to perform basic and advanced arithmetic operations (+,-,* and /).

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

Open http://localhost:5173. The API is available at http://localhost:8080/health.

## Calculations API

`POST http://localhost:8080/calculations` accepts an ordered array of tokens:

```json
{
  "tokens": [
    { "type": "number", "value": 2 },
    { "type": "operator", "value": "+" },
    { "type": "number", "value": 2 },
    { "type": "operator", "value": "*" },
    { "type": "number", "value": 5 }
  ]
}
```

The response is `200 OK` with `{"result":12}`. Number values must be finite JSON numbers. Operators are `+`, `-`, `*`, and `/`; parentheses use token type `parenthesis` and value `(` or `)`.

Invalid requests return `400` with `{"error":{"code":"invalid_tokens","message":"..."}}`. Division by zero and non-finite results return `422` with codes `division_by_zero` and `non_finite_result`, respectively.

## Run with Docker

```sh
docker compose up --build
```

Open http://localhost:5173.

## Checks

```sh
npm test
npm run coverage
npm run build
```

Coverage writes `frontend/coverage/index.html` and `backend/coverage.out`.
