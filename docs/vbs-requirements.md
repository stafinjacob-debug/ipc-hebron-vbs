# IPC Hebron VBS — product & infrastructure source of truth

This document is the canonical requirements reference for the VBS application. Implementation details and runbooks live in the repository root `README.md` and `docs/CREDENTIALS-AND-CONFIG.md`.

---

## Product MVP (domain)

**Goal:** Staff and volunteers can operate one VBS season at a time with registrations, rosters, and volunteer assignments. Parents get a clear placeholder until a dedicated parent portal ships.

**MVP capabilities**

| Area | Scope |
|------|--------|
| **Auth** | Email + password (credentials). Session via Auth.js (JWT). |
| **Roles** | `ADMIN`, `COORDINATOR`, `VOLUNTEER`, `PARENT` — enforced in UI and middleware; expand server-side checks on mutations as features grow. |
| **Screens** | Login; Dashboard; Seasons list; Registrations list; Children directory; Volunteers list. |
| **Data** | Guardians, children, VBS seasons, age-based classrooms, registrations (per child per season), volunteer profiles linked to users, assignments per season/class. |

**Out of scope for this MVP (planned later)**

- Public self-registration and payment flows  
- Email/SMS notifications  
- Document uploads (Azure Blob)  
- QR/check-in scanning  
- Full parent portal (read-only family view)  

---

## Environments, source control, and deployment

### Required environments

#### 1. Local development (macOS)

- Application runs on the developer Mac with clear setup instructions.  
- All secrets and connection strings come from environment variables (`.env.local`).  
- Local database via Docker Postgres or a hosted dev instance.  
- Seed data and scripts: install, run, migrate, seed, test.  

#### 2. Production (Azure)

- Source of truth: GitHub.  
- Deploy to the owner’s Azure subscription with production-safe configuration.  
- Repeatable deployments (CI/CD).  

### Source control

- Clean repository layout; secrets never committed.  
- `.env.example` documents required variables; `.gitignore` excludes local env files.  

### Deployment expectations

- Prefer **GitHub Actions** for CI/CD.  
- Production secrets in **GitHub Secrets** and/or **Azure Key Vault** / **App Service configuration**.  
- **Recommended Azure architecture (MVP):** **Azure App Service (Linux, Node 22)** running the Next.js **standalone** build, plus **Azure Database for PostgreSQL Flexible Server**. Optional later: **Azure Blob Storage** for files, Application Insights for monitoring.  
- Rationale: one deployable unit, straightforward ops, fits Prisma + Postgres, scales to typical church VBS traffic at low cost.  

### Environment configuration (application)

Support environment-specific values for:

- Database URL  
- Authentication (secret, app URL)  
- Storage, email/SMS, QR/badge, parent portal, API URLs, logging (placeholders documented in `.env.example` where not yet wired)  

**Local:** `.env.local`  
**Production:** Azure App Service **Application settings** (and Key Vault references when adopted)  

### Security (credentials)

- No hardcoded secrets; no secrets in logs.  
- Document **where** each value is stored (see `docs/CREDENTIALS-AND-CONFIG.md`).  

### MVP infrastructure expectation

1. Runnable locally on macOS  
2. Push-friendly GitHub layout  
3. Production target: Azure subscription with documented CI/CD  

---

## Legacy copy

The original infrastructure-only specification is preserved at the repository root as `vbs-requirements.md` for reference; **this `docs/vbs-requirements.md` file is authoritative** for product + infra going forward.
