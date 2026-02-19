# E-commerce Demo (Next.js + Prisma + Paystack)

A self-hostable e-commerce starter with multi-vendor support and a React Three Fiber animated background. Designed to run locally via Docker Compose and later be deployed to a real server and domain.

## Quickstart (local) — no Docker required

This project supports a Docker-free local development mode using SQLite so you can run everything on your PC without enabling virtualization.

1. Install Node.js (LTS recommended) and Git.
2. From the project root, run:

```bash
cd web
npm install
# generate Prisma client
npx prisma generate
# create schema and local sqlite DB and run seeds
npx prisma migrate dev --name init
npm run prisma:seed
# start the dev server
npm run dev
```

3. Open http://localhost:3000 — the app runs using a local SQLite database (`./web/dev.db`).

Paystack webhook testing (local)

- Use `ngrok` to expose your local server to the internet so Paystack sandbox can call your webhook:

```bash
npx ngrok http 3000
# set Paystack webhook URL to
# https://<ngrok-id>.ngrok.io/api/paystack/webhook
```

- The webhook endpoint validates signatures using your `PAYSTACK_SECRET` and will set orders to `PAID` when a successful charge event is received.

- Also supported: redirect verification URL `GET /api/paystack/verify?reference=<ref>` which Paystack will call after user payment; it triggers a server-side verify and marks the order accordingly.

Notes and extras:
- Search / Meilisearch: you can skip search locally or install the Meilisearch Windows binary and run it directly if you want the search features without Docker. See https://www.meilisearch.com/docs for Windows binaries.

- If later you want a production Postgres setup, change `prisma/schema.prisma` datasource provider to `postgresql`, set `DATABASE_URL` to a Postgres connection string, and run migrations.

If you want, I can now run the app in local mode with you (walk through the commands and verify the seeded data and authentication).

Running tests

- Install dev deps and run tests:

```bash
cd web
npm ci
npm test
```

Note: tests mock DB interactions and Paystack requests; ensure `PAYSTACK_SECRET` is set when running webhook tests so signature generation matches.

Fresh-environment smoke test (clean DB)

```bash
cd web
npm run smoke:local
```

What this does:
- creates a clean `prisma/smoke.db`
- applies schema migration (falls back to checked-in SQL if Prisma migrate engine fails on your machine)
- runs `npm run prisma:seed`
- runs targeted checkout/retry/admin lifecycle tests

CI

- GitHub Actions workflow: `.github/workflows/ci.yml`
- Enforces:
  - Prisma schema validation (`npx prisma validate`)
  - lint (`npm run lint`)
  - tests (`npm test`)
  - production build (`npm run build`)

Staging deploy and verification

- GitHub Actions workflow: `.github/workflows/staging.yml` (manual trigger via `workflow_dispatch`)
- Required repo secrets:
  - `STAGING_DEPLOY_WEBHOOK_URL`
  - `STAGING_BASE_URL` (for example, `https://staging.example.com`)
  - `STAGING_PAYSTACK_SECRET`
  - Optional: `STAGING_VERIFY_REFERENCE` (a real Paystack sandbox reference to validate callback redirect)
- The workflow:
  - triggers your staging deployment webhook
  - waits for rollout
  - verifies `/api/paystack/verify` missing-reference behavior
  - verifies webhook signature handling (invalid and valid signature paths)

Manual Paystack sandbox callback/webhook verification (staging)

1. Open staging storefront and complete a sandbox payment flow through Paystack checkout.
2. Confirm Paystack redirects through `/api/paystack/verify?reference=<real_ref>` and lands on `/checkout/result?...`.
3. Confirm order status updates in staging (`PAID` on success, `FAILED` on inventory failure path).
4. Confirm webhook delivery status is successful in your Paystack dashboard for the staging webhook URL.

Cloud development (no local Docker required) — recommended now:

- Gitpod: Open this repository in Gitpod to run the full stack (Postgres, Redis, Meilisearch) and the Next.js app in a cloud workspace. Use the URL:
  `https://gitpod.io/#<your-repo-url>`
- GitHub Codespaces: A `.devcontainer/` is provided so you can open the repo in Codespaces as well.

Both options give you an HTTPS URL for the app and make Paystack webhook testing simpler (use the workspace URL for sandbox webhooks).

## Notes
- Uses Paystack sandbox keys for payments. Add your keys to `.env` (see `.env.example`).
- Prisma migrations and seeds will be provided.
- Designed for easy migration to a VPS and a real domain.
