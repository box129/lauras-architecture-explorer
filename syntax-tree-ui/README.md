# Syntax Tree UI

The frontend is a React 19, TypeScript, and Vite application for the Syntax Tree refurbished backend.

Use the canonical setup and combined launcher documented in the repository root [README](../README.md).

Direct frontend commands, after root setup:

```powershell
npm run dev
npm run lint
npm run build
```

Set `VITE_API_TARGET` when the backend is not at `http://localhost:8000`. HTTP and WebSocket `/api` traffic is proxied to that target. `VITE_WS_BASE_URL` is optional and is intended only for deployments where browser WebSocket traffic cannot use the same-origin `/api` proxy.
