# Credentials and configuration map

**Rule:** Nothing in this file is a secret. Replace placeholders in your own password manager, GitHub Secrets, and Azure portal. Never commit real values.

---

## 1. Local development (Mac)

| Name | Where to set | Purpose |
|------|----------------|--------|
| `DATABASE_URL` | `web/.env.local` | PostgreSQL connection (e.g. Docker Compose in `web/docker-compose.yml`). |
| `AUTH_SECRET` | `web/.env.local` | Auth.js session signing. Generate: `openssl rand -base64 32`. |
| `AUTH_URL` | `web/.env.local` | Base URL of the app (e.g. `http://localhost:3000`). |
| `SEED_ADMIN_EMAIL` | `web/.env.local` (optional) | First admin user email for `npm run db:seed`. |
| `SEED_ADMIN_PASSWORD` | `web/.env.local` | Strong password for seed admin (and sample volunteer); min 8 characters. |
| `STRIPE_SECRET_KEY` | `web/.env.local` (optional) | Secret key for Stripe Checkout on `/register` when a form has card payment enabled. Use `sk_test_…` locally. |
| `STRIPE_WEBHOOK_SECRET` | `web/.env.local` (optional) | Signing secret for `POST /api/stripe/webhook` (Dashboard webhook or `stripe listen`). |
| `NEXT_PUBLIC_SITE_URL` | `web/.env.local` (optional) | Public site origin for Checkout return URLs; often defaults from `AUTH_URL`. |

Copy from `web/.env.example`. Prisma CLI scripts (`db:migrate`, etc.) use `dotenv-cli` with `.env.local`. The seed script (`npm run db:seed`) loads `web/.env.local` itself from disk, so it does not depend on your shell working directory.

### 1a. Dev vs production database (same Azure server)

On the **Azure PostgreSQL Flexible Server** `ipc-hebron-vbs-87e0314c-pg` (resource group `rg-ipc-hebron-vbs-dev`), use **two databases** on the same host:

| Database name | Use for |
|---------------|---------|
| `vbs` | **Local development** and shared “dev” data (`web/.env.local` → `.../vbs?sslmode=require`). |
| `vbs_production` | **Production** only — App Service, GitHub Actions production `DATABASE_URL`, and any `…/vbs_production?sslmode=require` secret. |

Apply migrations to production after schema changes:

```bash
cd web && npm run db:migrate:deploy:production
```

That runs `prisma migrate deploy` against `vbs_production` using the same user/host as in `.env.local`, only changing the database name (see `web/scripts/run-migrate-for-db.mjs`). New production databases start **empty**; run `npm run db:seed` pointed at production only if you intentionally want seed data there, or migrate real data separately.

---

## 2. GitHub (CI/CD)

Configure in the repository: **Settings → Secrets and variables → Actions**.

### 2a. Secrets (sensitive)

| Secret name | Used by | Description |
|-------------|---------|-------------|
| `DATABASE_URL` | Workflow: `prisma migrate deploy`, `next build` | **Production** Postgres URL (TLS). Must use the **`vbs_production`** database name on the flexible server (not `vbs`). Same URL the App Service uses. |
| `AUTH_SECRET` | Workflow: `next build` | Same value you set in Azure for production (or a build-time-only secret if you rotate separately—prefer one production secret). |
| `AUTH_URL` | Workflow: `next build` | Public HTTPS origin of the site, e.g. `https://your-app.azurewebsites.net` (no trailing slash). |
| `AZURE_WEBAPP_PUBLISH_PROFILE` | `azure/webapps-deploy` | Contents of the App Service **Download publish profile** file (XML). **Alternative:** use OpenID Connect (OIDC) with Azure login instead of this secret (see below). |
| `AZURE_WEBAPP_NAME` | Deploy step | App Service resource name (short name, e.g. `ipc-hebron-vbs`). |

**Optional OIDC path (no publish profile XML in GitHub):**

| Secret name | Description |
|-------------|-------------|
| `AZURE_CLIENT_ID` | App registration (service principal) client ID. |
| `AZURE_TENANT_ID` | Azure AD tenant ID. |
| `AZURE_SUBSCRIPTION_ID` | Target subscription. |

If you switch to OIDC, replace the publish-profile deploy step with `azure/login` and `az webapp deploy` (or an equivalent action). Document the exact YAML in your fork when you adopt OIDC.

### 2b. Variables (non-secret, optional)

| Variable | Example | Description |
|----------|---------|-------------|
| `AUTH_URL` | Same as secret | You may use a **variable** instead of a secret if your org treats the public URL as non-sensitive. |

---

## 3. Azure (production runtime)

### 3a. Azure Database for PostgreSQL Flexible Server

| Item | Notes |
|------|--------|
| Admin user / password | Set at server creation; **do not** paste into the repo. |
| Connection string | Build `DATABASE_URL` as `postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require`. Use database name **`vbs_production`** for App Service and CI; use **`vbs`** only for local/dev. |
| Firewall | Allow Azure services; optionally your IP for manual access. |

### 3b. App Service (Linux)

In **Configuration → Application settings** (slot settings as needed):

| Setting name | Source | Notes |
|--------------|--------|--------|
| `DATABASE_URL` | Key Vault reference or plain app setting | Prefer **Key Vault reference** once Key Vault is set up. |
| `AUTH_SECRET` | Key Vault or app setting | Must match the value used to sign sessions. |
| `AUTH_URL` | App setting | Public site URL (`https://…`). |
| `NODE_ENV` | `production` | Standard for Node. |
| `MICROSOFT_GRAPH_TENANT_ID` | App setting | Azure AD tenant (directory) ID for app-only Graph mail. |
| `MICROSOFT_GRAPH_CLIENT_ID` | App setting | App registration (client) ID. |
| `MICROSOFT_GRAPH_CLIENT_SECRET` | App setting | Client secret value (rotate periodically). |
| `MICROSOFT_GRAPH_MAILBOX` | App setting | Sender UPN Graph uses (`/users/{mailbox}/sendMail`), e.g. `no-reply@yourdomain.org`. |
| `EMAIL_FROM_DISPLAY_NAME` | App setting | Optional; friendly “from” name in invite/registration emails. |
| `REGISTRATION_EMAIL_BRAND` | App setting | Optional; brand line in registration email HTML (see `web/.env.example`). |
| `STRIPE_SECRET_KEY` | Key Vault or app setting | Required if any published form uses Stripe checkout. |
| `STRIPE_WEBHOOK_SECRET` | Key Vault or app setting | Signing secret for the production webhook endpoint `https://<your-host>/api/stripe/webhook`. |
| `NEXT_PUBLIC_SITE_URL` | App setting | Optional; public HTTPS origin if Checkout success/cancel URLs must differ from `AUTH_URL`. |
| `WEBSITE_RUN_FROM_PACKAGE` | `1` | Often set automatically by zip deploy; confirm if using run-from-package. |

**Startup command** (General settings):

```text
node server.js
```

Set the **startup directory** / working directory to the root of the deployed package (the standalone output root that contains `server.js`). If the zip root is wrong, the process will not find `server.js`.

**Pre-built zip (GitHub Actions / `az webapp deploy`):** Set **`SCM_DO_BUILD_DURING_DEPLOYMENT=false`** (and optionally **`ENABLE_ORYX_BUILD=false`**) so App Service does not run Oryx “optimize” / `npm install` on your artifact. Otherwise the site can sit in “Starting…” until timeout. The standalone output includes a `.deployment` file with this flag; the app setting enforces it on the resource.

### 3c. Azure Key Vault (recommended progression)

1. Create a Key Vault in the same subscription.  
2. Store secrets: e.g. `DatabaseUrl`, `AuthSecret`.  
3. Enable managed identity on the App Service.  
4. Grant the identity **Get** on secrets.  
5. In App Service application settings, use references such as `@Microsoft.KeyVault(SecretUri=https://your-vault.vault.azure.net/secrets/DatabaseUrl/)`.  

Document the exact URIs in your internal runbook only.

---

## 4. Rotation and rollback (basics)

- **Rotate `AUTH_SECRET`:** Generate a new value; update Azure (and GitHub if used at build time); users must sign in again.  
- **Rotate DB password:** Update Postgres admin password in Azure, then update `DATABASE_URL` everywhere it is stored.  
- **Rollback deploy:** Re-run a previous successful GitHub Actions workflow run, or use deployment slots (staging/production swap) once configured.  

---

## 5. Future integrations (placeholders)

When you add features, expect additional secrets (stored only in Azure / GitHub / Key Vault):

- **SMTP** — host, user, password, from-address.  
- **SMS provider** — API key.  
- **Azure Blob** — connection string or SAS; prefer managed identity + RBAC where possible.  
- **Stripe** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; register webhook URL `https://<your-host>/api/stripe/webhook` for `checkout.session.completed`.

See `web/.env.example` for naming suggestions.
