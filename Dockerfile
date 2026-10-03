# syntax=docker/dockerfile:1

# Build both localized production bundles from the lockfile.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build-locale

# Serve the static output with Nginx at /en/ and /pt/.
FROM nginx:1.30-alpine-slim
RUN rm -rf /usr/share/nginx/html/*
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/en/browser/en/ /usr/share/nginx/html/en/
COPY --from=build /app/dist/pt/browser/pt/ /usr/share/nginx/html/pt/
EXPOSE 80
