# Documenso Question Bank

Use these questions to test whether Syntax Tree understands Documenso. Expected answers are answer keys for QA; they should be verified by source citations during the real test.

## Architecture Questions

### 1. What does Documenso do at a high level?

Expected answer: Documenso is a document signing platform. It lets users create or upload documents, configure recipients and fields, send signing requests, let recipients sign, and then complete/seal signed documents. A strong answer should connect the UI, APIs, jobs, database/storage, email, and PDF signing layers.

### 2. What are the main architectural components?

Expected answer: Main components should include the Remix/Hono web app, React Router UI routes, API v1 ts-rest, API v2 tRPC/OpenAPI, internal tRPC, files API, jobs system, document business logic, Prisma/database, provider abstractions, email, PDF signing, auth, shared UI, docs app, and Openpage API.

### 3. How does the server decide which requests go to UI versus API handlers?

Expected answer: The Hono server in `apps/remix/server/router.ts` mounts explicit API routes for auth, files, AI, API v1, jobs, internal tRPC, API v2, and API v2 beta, while the React Router adapter in `apps/remix/server/main.js` handles the application UI and static assets.

### 4. What is the difference between API v1, API v2, and internal tRPC?

Expected answer: API v1 is a ts-rest REST API under `/api/v1` and is deprecated but maintained. API v2 and v2 beta use tRPC OpenAPI handlers under `/api/v2` and `/api/v2-beta`. Internal tRPC under `/api/trpc` is used for frontend-to-backend app communication with session-style context.

### 5. What supporting apps exist besides the main product app?

Expected answer: `apps/docs` is the documentation site, and `apps/openpage-api` is a public analytics API. They should not be mistaken for the main signing product app.

## Document Flow Questions

### 6. How does a document move from upload to completed signed PDF?

Expected answer: A document is uploaded through the file/storage layer, recipients and fields are configured, sending triggers signing request emails, recipients sign with token-based flows, completion can trigger `internal.seal-document`, the signing provider cryptographically signs or seals the PDF, and the result is stored through the storage provider.

### 7. What happens when a document is sent?

Expected answer: Document send logic validates recipients/fields/status, updates document state, and triggers jobs such as `send.signing.requested.email` for recipients and possibly `internal.seal-document` depending on document state. The exact answer must cite document send source, not only docs.

### 8. What happens when a recipient completes signing?

Expected answer: Completion logic updates recipient/document state, may trigger next-recipient signing emails, and may trigger `internal.seal-document` when the document or envelope reaches a terminal state. The answer should cite token completion logic and job trigger points.

### 9. What happens if a recipient rejects a document?

Expected answer: Rejection logic marks the document or recipient state as rejected/cancelled, triggers sealing or cleanup behavior, and sends rejection-related emails. A good answer should cite `reject-document-with-token` and related email/seal job triggers.

### 10. Which parts of the flow are synchronous and which are background jobs?

Expected answer: Request handlers and business logic perform validation and state transitions synchronously; email sending, sealing, webhook execution, reminders, and sweeps are background jobs through the jobs client/provider.

## Provider And Backend Questions

### 11. How does Documenso choose where uploaded files are stored?

Expected answer: Storage upload behavior is selected from `NEXT_PUBLIC_UPLOAD_TRANSPORT`, with provider implementations under `packages/lib/universal/upload`. Depending on configuration, files can be stored through database/S3-like paths. The answer must cite provider dispatch code.

### 12. How does Documenso choose how to sign PDFs?

Expected answer: `packages/signing/index.ts` reads `NEXT_PRIVATE_SIGNING_TRANSPORT`, defaulting to local signing when absent, and dispatches to local or external signing implementations such as Google Cloud HSM where configured.

### 13. How does Documenso choose how to send email?

Expected answer: `packages/email/mailer.ts` reads `NEXT_PRIVATE_SMTP_TRANSPORT`, defaulting to SMTP auth, and chooses among supported transports such as SMTP auth, SMTP API, Resend, and MailChannels.

### 14. How does the jobs provider abstraction work?

Expected answer: `packages/lib/jobs/client/client.ts` selects a provider from `NEXT_PRIVATE_JOBS_PROVIDER`, with local, BullMQ, and Inngest implementations. The server exposes job handling through `/api/jobs/*` and starts cron behavior through the jobs client.

### 15. What if `NEXT_PRIVATE_JOBS_PROVIDER` changes from local to Inngest?

Expected answer: The jobs client should dispatch triggers through the Inngest provider instead of the local database-backed provider. Cron behavior may differ because Inngest handles managed job execution externally. Syntax Tree should not claim operational success without source-backed provider evidence.

### 16. What if `NEXT_PUBLIC_UPLOAD_TRANSPORT` changes from database to S3?

Expected answer: Upload and download paths should use S3-compatible storage behavior rather than database/base64 storage. API code has branches that check upload transport, so the system must explain which routes or download behavior depend on this setting.

## UI/UX Questions

### 17. What are the major UI route groups?

Expected answer: Major route groups include authenticated app routes, unauthenticated routes, recipient signing routes, profile routes, embed routes, redirects, internal routes, and API route groups under `apps/remix/app/routes`.

### 18. What UI components seem central to document preparation?

Expected answer: `packages/ui/primitives/document-flow` contains document flow components for adding signers, adding fields, settings, field items, advanced field settings, send action dialogs, and missing-signature-field handling.

### 19. What UI components seem central to template preparation?

Expected answer: `packages/ui/primitives/template-flow` contains template flow components for template fields, placeholder recipients, and template settings.

### 20. What should a QA tester inspect in the document creation UI?

Expected answer: Upload affordance, recipient entry, field placement, field validation, signing order, send dialog, missing signature field warnings, error/empty/loading states, responsive layout, and whether source proof connects UI actions to backend document logic.

## Source-Proof Questions

### 21. Show me the source proof for where `/api/v2` is mounted.

Expected answer: The proof should cite `apps/remix/server/router.ts`, including the `/api/v2/openapi.json`, download route shadowing, and `/api/v2/*` handler using `openApiTrpcServerHandler`.

### 22. Show me the source proof for where `/api/trpc` is mounted.

Expected answer: The proof should cite `apps/remix/server/router.ts`, where `/api/trpc/*` gets rate limiting and `reactRouterTrpcServer`.

### 23. Show me the source proof for the signing provider selection.

Expected answer: The proof should cite `packages/signing/index.ts` and show selection from `NEXT_PRIVATE_SIGNING_TRANSPORT`.

### 24. Show me the source proof for the email provider selection.

Expected answer: The proof should cite `packages/email/mailer.ts` and show selection from `NEXT_PRIVATE_SMTP_TRANSPORT`.

### 25. Show me the source proof for the jobs provider selection.

Expected answer: The proof should cite `packages/lib/jobs/client/client.ts` and provider implementations under `packages/lib/jobs/client`.

## Failure And Uncertainty Questions

### 26. What parts of Documenso should not be considered proven by README or architecture docs alone?

Expected answer: Runtime behavior of routes, providers, jobs, signing, storage, auth, and UI flows should not be considered proven by README or architecture docs alone. Those docs are orientation-only unless backed by implementation files.

### 27. What if an external provider like Resend, S3, Google KMS, or Inngest is unavailable?

Expected answer: Syntax Tree may identify configured provider boundaries and likely failure areas, but it should not invent operational recovery behavior without source evidence. It should ask for or inspect provider-specific error handling.

### 28. Where might Syntax Tree overstate confidence?

Expected answer: It might overstate confidence by treating `ARCHITECTURE.md`, `.env.example`, or package names as proof; by assuming every provider is active; by turning route directories into user flows without reading route code; or by assuming docs app behavior is the main product.

### 29. What if document sealing fails?

Expected answer: Syntax Tree should investigate `internal.seal-document` job handler, retry/error handling in the jobs provider, document status transitions, and notification/webhook side effects. It should not propose fixes unless asked.

### 30. What does the shared UI package do?

Expected answer: The UI package provides reusable primitives and product-specific workflow components, including document flow, template flow, signature pad, form fields, dialogs, selectors, data tables, and styling primitives used by the app UI.
