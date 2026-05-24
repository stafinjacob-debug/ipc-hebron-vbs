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

## Badge printing (thermal, check-in desk)

**Status:** Planned — not implemented in-app yet (see `/reports` and check-in desk placeholders).

**Goal:** At the check-in desk, staff open the VBS portal on an iPad, check a child in, and print a name badge to a **thermal label printer** connected to that iPad (or on the same local network). Admins configure what appears on each badge per season.

### Hardware & desk setup

| Item | Notes |
|------|--------|
| **iPad** | Safari → staff login → **Check-in desk** (`/check-in`). One iPad per check-in station is typical. |
| **Thermal printer** | Label/name-badge printer (e.g. Brother QL, Zebra ZD/ZQ, Star Micronics mC-Print / TSP). Prefer models with **AirPrint**, **Wi‑Fi/Ethernet**, or vendor **web print** (e.g. Star WebPRNT) so Safari can send jobs without a native app. |
| **Connection** | USB/Lightning/USB‑C adapter, Bluetooth, or Wi‑Fi — depends on printer model. Document the pairing steps for your church’s hardware in an internal runbook. |
| **Label stock** | Match admin template to physical label size (e.g. 2″×3″, 62 mm continuous). |

Printing is initiated **from the browser on the iPad** after check-in (or via reprint on a registration). The app renders badge content from registration data and sends a print job to the **locally selected** printer — no cloud print service is required for the default design.

### Admin configuration (per season)

Admins (`ADMIN`, and optionally `COORDINATOR`) configure badge content under season settings (planned UI: **Settings → Badge printing**, or a tab on the active season).

| Setting | Purpose |
|---------|---------|
| **Enabled** | Turn badge printing on/off for the season. |
| **Label size / orientation** | Match physical media (width, height, DPI). |
| **Fields to print** | Toggle which data lines appear — e.g. child first/last name, registration number, classroom name, classroom **badge display name**, classroom **check-in label**, season name/year, optional QR (check-in token URL). |
| **Optional logo** | Small season or church mark at top (URL or uploaded asset). |
| **Medical / allergy line** | Optional short flag (e.g. “Allergies on file”) — avoid full medical text on a public badge unless policy allows. |
| **Auto-print on check-in** | When enabled, print once when staff taps **Check in**; otherwise require an explicit **Print badge** action. |
| **Preview** | Sample badge using a test registration before saving the template. |

**Data already in the system** that badges can use today: `Registration.registrationNumber`, `Registration.checkInToken` (for QR), `Child` name, `Classroom.name`, `Classroom.badgeDisplayName`, `Classroom.checkInLabel`, and season title/dates.

### Check-in desk workflow

1. Volunteer signs in on the iPad and opens **Check-in desk**.  
2. Finds the child (search/list) and taps **Check in** (or scans QR when scanning ships).  
3. If auto-print is on, the badge prints immediately; otherwise staff tap **Print badge**.  
4. **Reprint:** From the registration detail page or check-in row menu — same template, does not duplicate check-in.  

Roles with check-in access (`ADMIN`, `COORDINATOR`, check-in volunteers per `canUseCheckInActions`) can print; only admins edit the badge template.

### Implementation notes (for developers)

- Prefer **client-side print** (CSS `@media print`, or vendor JS SDK) so jobs go straight to the iPad’s printer; avoid storing printer credentials on the server unless using network printers with a documented API.  
- Store template JSON on the season (e.g. extend `PublicRegistrationSettings` or a dedicated `BadgePrintSettings` model) — not in `.env`.  
- Respect iOS Safari limits: Bluetooth raw printing from the web is restricted; **network/AirPrint/vendor web print** is the supported path for iPad + Safari.  
- See `docs/CREDENTIALS-AND-CONFIG.md` §6 for configuration map and optional env placeholders.

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
- Storage, email/SMS, QR/badge (see **Badge printing** above), parent portal, API URLs, logging (placeholders documented in `.env.example` where not yet wired)  

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
