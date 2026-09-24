FROM golang:1.24-alpine AS backend-build
WORKDIR /src/backend
COPY backend/go.mod ./
COPY backend/*.go ./
RUN CGO_ENABLED=0 go build -o /server .

FROM alpine:3.22 AS backend
COPY --from=backend-build /server /server
EXPOSE 8080
CMD ["/server"]

FROM node:24-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
RUN npm ci
COPY frontend/ ./frontend/
EXPOSE 5173
CMD ["npm", "run", "dev", "--workspace", "frontend", "--", "--host", "0.0.0.0"]
