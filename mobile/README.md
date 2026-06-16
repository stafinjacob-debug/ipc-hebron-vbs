# IPC Hebron VBS — iOS / iPad app

Native staff app for **check-in desk iPads** and day-of volunteer workflows. It connects to the same Next.js backend as the admin website via the `/api/mobile/v1/*` REST API.

## Features

- **Check-in desk** — scan registration QR codes, look up by registration number or family code, search by name/phone, check in or undo
- **Brother direct printing** — seamless badges on QL-820NWB and similar (Planning Center–style; no print dialog)
- **Badge printing (AirPrint fallback)** — when Brother is not configured
- **Dismissal** — check students out at pickup
- **Classes** — view rosters (hidden in station mode)
- **Announcements** — season news for staff
- **Station mode** — simplified UI for dedicated iPad check-in stations (Check-In + More tabs only)
- **Face ID / Touch ID lock** — optional re-auth when returning to the app

## Prerequisites

- Node.js 20+
- Xcode 15+ (Simulator or local device builds)
- [Apple Developer Program](https://developer.apple.com/programs/) membership (TestFlight / App Store)
- The VBS web app deployed over **HTTPS** and reachable from the iPad Wi‑Fi
- A staff account with check-in permissions (`CHECK_IN_VOLUNTEER`, `TEACHER`, or admin roles)
- Brother **QL-820NWB** (or QL-810W / QL-1110NWB) on the same Wi‑Fi as the iPad — **recommended** for silent printing
- Or any AirPrint label printer as fallback (shows iOS print sheet each time)

## Setup (local development)

```bash
cd mobile
cp .env.example .env
npm install
```

Edit `.env`:

```env
# Production (recommended for iPad stations):
EXPO_PUBLIC_API_URL=https://your-vbs-site.azurewebsites.net

# Local dev on Simulator (same Mac as Next.js):
# EXPO_PUBLIC_API_URL=http://localhost:3000

# Physical iPad on Wi‑Fi — use your Mac’s LAN IP, not localhost:
# EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

Start the web API (from `web/`):

```bash
npm run dev
```

Run the mobile app:

```bash
cd mobile
npm start
```

Press `i` for iOS Simulator. **Expo Go does not include Brother SDK** — use a [development build](#development-build-on-device) on physical iPads.

## iPad check-in station setup

1. Install a **development or TestFlight build** on each iPad (not Expo Go).
2. Sign in with a check-in volunteer or admin account.
3. Select the active VBS season.
4. Open **More → Brother label printer** — enable direct printing, enter printer IP (Wi‑Fi) or pair Bluetooth, run **Print test label**.
5. Open **More → Station mode** and turn it on.
6. Enable **Face ID / Touch ID lock**.
7. In admin, enable **Season → Badge printing** and **Auto-print on check-in** if desired.
8. Leave the iPad on **Check-In**. Scan QR codes or type registration codes — badges feed automatically when Brother is configured.

On wide screens (landscape iPad), scan/lookup appears on the left and name search on the right.

## Badge printing

### Brother direct (recommended)

Uses Brother’s iOS SDK (`react-native-brother-print`) — same idea as Planning Center Check-Ins:

| Action | Behavior |
|--------|----------|
| One-time setup | **More → Brother label printer** — IP + model (e.g. QL-820NWB) |
| Check in (auto-print on) | Label prints **immediately**, no dialog |
| Manual **Print badge** | Same silent print |

Requires a **native build** (`expo run:ios` or EAS Build). Does not work in Expo Go.

### AirPrint fallback

If Brother direct printing is off, the app falls back to **AirPrint** (`expo-print`), which shows the iOS print sheet every time.

Badge layout and auto-print are configured in **Season → Badge printing** on the admin site.

## TestFlight & App Store (EAS Build)

Expo Application Services (EAS) builds signed `.ipa` files in the cloud — no Mac required for each build after initial setup.

### One-time setup

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. Install EAS CLI and log in:

```bash
npm install -g eas-cli
eas login
```

3. From `mobile/`, link the project to Expo:

```bash
cd mobile
eas init
```

Copy the project ID into `.env`:

```env
EAS_PROJECT_ID=your-uuid-from-eas-init
```

4. Edit `eas.json` → `submit.production.ios` with your **Apple Team ID** and **App Store Connect App ID** (create the app record at [appstoreconnect.apple.com](https://appstoreconnect.apple.com) first).

5. Set the production API URL as an EAS secret (used at build time):

```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value https://your-vbs-site.azurewebsites.net --scope project
```

### Build for TestFlight

```bash
cd mobile
eas build --platform ios --profile production
```

When the build finishes, submit to App Store Connect:

```bash
eas submit --platform ios --profile production
```

In **App Store Connect → TestFlight**, add internal testers (your team) or external testers. Install via the TestFlight app on each iPad.

For a quick internal build without App Store review:

```bash
eas build --platform ios --profile preview
```

Install the `.ipa` via Apple Configurator or ad-hoc provisioning (advanced).

## Android builds

The same app runs on Android phones and tablets. Brother direct printing is **iOS/iPad only**; Android uses AirPrint-style sharing where badge printing is enabled.

### Preview APK (internal testing)

```bash
cd mobile
eas build --platform android --profile preview
```

Download the APK from the Expo build page and install on test devices (enable “Install unknown apps” if sideloading).

### Production (Google Play)

```bash
cd mobile
eas build --platform android --profile production
eas submit --platform android --profile production
```

Package name: `org.ipchebron.vbs`. Configure a Google Play service account in EAS for automated submit, or upload the `.aab` manually in Play Console.

Build both platforms for a release:

```bash
eas build --platform all --profile production
```

### Development build on device

For local iteration with native modules (camera, print):

```bash
cd mobile
eas build --platform ios --profile development
# or locally:
npx expo prebuild --platform ios
npx expo run:ios --device
```

Bundle ID: `org.ipchebron.vbs` (see `app.config.ts`).

## API endpoints used

| Endpoint | Purpose |
|----------|---------|
| `POST /api/mobile/v1/auth/login` | Staff sign-in |
| `GET /api/mobile/v1/seasons` | List seasons |
| `GET /api/mobile/v1/seasons/:id/check-in/settings` | Badge print flags |
| `POST /api/mobile/v1/seasons/:id/check-in/lookup` | QR / code lookup |
| `GET /api/mobile/v1/seasons/:id/search` | Name search |
| `PATCH /api/mobile/v1/seasons/:id/registrations/:id/attendance` | Check in / out |
| `GET /api/mobile/v1/seasons/:id/registrations/:id/badge?format=png` | Badge PNG for Brother print |
| `GET /api/mobile/v1/seasons/:id/registrations/:id/badge` | Badge HTML (AirPrint fallback) |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Network error on device | Use HTTPS in production; on LAN use the server IP in `EXPO_PUBLIC_API_URL`, not `localhost`. |
| Camera won’t open | Settings → Privacy → Camera → allow for VBS app. |
| 403 on check-in | Account role must include check-in permissions. |
| Print dialog every check-in | Enable **Brother direct printing** in More → Brother label printer |
| Brother test print fails | Same Wi‑Fi as iPad; verify IP; load DK-2205 labels |
| Module not found / Expo Go | Build native app: `npx expo run:ios --device` |
