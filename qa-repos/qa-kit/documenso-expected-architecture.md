# Documenso Expected Architecture

This file describes the architecture Syntax Tree should discover when analyzing Documenso. It is a QA reference, not generated documentation.

## High-Level Shape

Documenso is a TypeScript monorepo for document signing. The main product surface is the Remix/React Router app in `apps/remix`, served by a Hono server. Shared implementation lives under `packages`, including API contracts, tRPC routers, business logic, database access, authentication, email, signing, UI primitives, and test packages.

Expected top-level areas:

- Main web app: `apps/remix`, especially Hono server setup and React Router routes.
- React Router UI: authenticated, unauthenticated, recipient signing, profile, embed, redirect, API route groups under `apps/remix/app/routes`.
- API v1: deprecated but maintained REST API using ts-rest in `packages/api`.
- API v2 and beta: tRPC OpenAPI handlers in `packages/trpc`.
- Internal frontend API: `/api/trpc/*` mounted from the Remix/Hono server.
- File API: upload and file retrieval routes under `apps/remix/server/api/files`.
- Jobs: provider-backed background jobs under `packages/lib/jobs`.
- Document business logic: document send, complete, reject, seal, audit, fields, recipients, templates, envelopes.
- Storage provider layer: database/S3/other upload transport selection under `packages/lib/universal/upload`.
- Email provider layer: mailer and React Email templates under `packages/email`.
- PDF signing provider layer: local and Google Cloud signing under `packages/signing`.
- Database layer: Prisma schema/client/migrations in `packages/prisma`.
- Auth layer: auth server routes and session/OAuth/passkey support under `packages/auth`.
- UI component library: shadcn/Radix/Tailwind primitives under `packages/ui`.
- Supporting apps: docs app and Openpage analytics API under `apps/docs` and `apps/openpage-api`.

## Expected System Map

Syntax Tree should prefer concept groups over raw folders. A useful first map should look approximately like this:

```text
Documenso
  -> Remix/Hono Application Shell
  -> React Router Product UI
  -> API Surface
  -> Document Signing Workflow
  -> Background Jobs
  -> Provider Abstractions
  -> Persistence And Storage
  -> Authentication And Access
  -> Email And Notifications
  -> PDF Rendering And Signing
  -> Shared UI System
  -> Supporting Apps
```

Important: if Syntax Tree shows only `apps`, `packages`, and `docker`, the architecture map is too shallow for this QA target.

## Expected Drilldown Paths

### Application Shell

```text
System
  -> Remix/Hono Application Shell
    -> Hono server entrypoint
    -> request context and middleware
    -> security headers
    -> route mounting
    -> React Router adapter
```

Source evidence should include `apps/remix/server/router.ts` and `apps/remix/server/main.js`.

### API Surface

```text
System
  -> API Surface
    -> /api/v1/* ts-rest API
    -> /api/v2/* tRPC OpenAPI API
    -> /api/v2-beta/* beta tRPC OpenAPI API
    -> /api/trpc/* internal frontend tRPC
    -> /api/jobs/* background job handler
    -> /api/files/* file handling
    -> /api/auth/* auth server
```

The top-level proof is the Hono route mounting in `apps/remix/server/router.ts`. Deeper proof should move into `packages/api`, `packages/trpc`, `packages/lib/jobs`, `apps/remix/server/api/files`, and `packages/auth`.

### Document Signing Flow

```text
System
  -> Document Signing Workflow
    -> document creation or upload
    -> recipient setup
    -> field setup
    -> sending document
    -> signing request email job
    -> recipient signs with token
    -> completion/rejection logic
    -> seal-document job
    -> signing provider
    -> storage provider
    -> audit/webhook/email side effects
```

Expected source evidence should include document business logic under `packages/lib/server-only/document`, job definitions under `packages/lib/jobs/definitions`, provider code under `packages/signing`, email code under `packages/email`, and storage upload code under `packages/lib/universal/upload`.

### Provider Abstractions

```text
System
  -> Provider Abstractions
    -> upload/storage provider selected by NEXT_PUBLIC_UPLOAD_TRANSPORT
    -> signing provider selected by NEXT_PRIVATE_SIGNING_TRANSPORT
    -> email provider selected by NEXT_PRIVATE_SMTP_TRANSPORT
    -> jobs provider selected by NEXT_PRIVATE_JOBS_PROVIDER
```

These claims must be backed by source code that reads the environment variables and dispatches to provider implementations. README or `.env.example` can guide the search but is not enough proof by itself.

### UI And UX Surface

```text
System
  -> React Router Product UI
    -> authenticated workspace routes
    -> unauthenticated auth/onboarding routes
    -> recipient signing routes
    -> embed/share/profile/redirect route groups
    -> shared UI primitives
    -> document flow components
    -> template flow components
```

Source evidence should include `apps/remix/app/routes` and UI primitives under `packages/ui/primitives`.

## Proof Rules

Code-backed proof:

- Hono route mounts and middleware.
- tRPC and ts-rest router files.
- Document send/complete/reject/seal logic.
- Job definitions and handlers.
- Provider selection code.
- Prisma schema and generated database access boundaries.
- Auth server route files.
- UI route components and document-flow primitives.

Orientation-only material:

- `README.md`
- `ARCHITECTURE.md`
- `CONTRIBUTING.md`
- `.env.example`
- docs app content
- package manifests, except for package dependency and script facts

The QA should flag answers that present orientation-only claims as verified runtime behavior.

## Expected Weak Spots

Syntax Tree should be allowed to be uncertain about:

- Exact runtime behavior of provider implementations without drilling into each provider.
- Enterprise-only behavior under `packages/ee` unless source-backed.
- External service behavior such as Stripe, Resend, S3, Google KMS, Inngest, or OAuth providers.
- UI behavior that requires live browser interaction, unless source code or test files prove it.
- Generated or translated content that inflates file volume but is not architectural core.
