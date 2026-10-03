/**
 * Where the browser suite points. By default it starts e2e/serve.mjs on E2E_PORT (4300)
 * against dist/. Set E2E_BASE_URL (e.g. http://127.0.0.1:8080 for the Docker container)
 * to test an already running server instead.
 */
export const LOCAL_PORT = Number(process.env.E2E_PORT || 4300);
export const EXTERNAL_BASE_URL = process.env.E2E_BASE_URL?.replace(/\/+$/, "");
export const BASE_URL = EXTERNAL_BASE_URL ?? `http://127.0.0.1:${LOCAL_PORT}`;
export const APP_ORIGIN = new URL(BASE_URL).origin;
