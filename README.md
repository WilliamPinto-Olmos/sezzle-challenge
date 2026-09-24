# Sezzle Challenge

Go API and React frontend in one repository.

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
