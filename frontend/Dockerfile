# syntax=docker/dockerfile:1
#
# Frontend image: builds the Vite app and serves the static bundle with nginx.
# nginx also reverse-proxies /api to the backend so the SPA's relative `/api`
# calls work in production. The backend URL is configurable at runtime via the
# BACKEND_URL env var (default: http://backend:8080, the compose service name).

# ── Stage 1: build the static assets ──
# Debian/glibc (not alpine/musl). The committed package-lock.json was generated
# with npm 11, which records the rolldown/vite wasm optional deps differently
# than npm 10 (shipped by the node images) — so we pin npm 11 to make `npm ci`
# accept the lock file ("@emnapi/* missing from lock file" otherwise).
FROM node:22-slim AS builder
WORKDIR /app
RUN npm install -g npm@11.6.2
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: serve with nginx ──
FROM nginx:1.31-alpine
# The official image runs envsubst over *.template files into /etc/nginx/conf.d at startup.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html
ENV BACKEND_URL=http://backend:8080
EXPOSE 80
