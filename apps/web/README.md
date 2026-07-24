# Belt-Kit — Web App

The staff-facing web dashboard (Next.js + Tailwind), styled in the **Burgundy & Rose Gold** luxury theme with premium fonts (Cormorant Garamond + Jost) and Framer Motion animations. Light backgrounds throughout.

Phase 1 screens: **luxury login**, **dashboard overview**, **Users & Roles** (view/edit accounts), plus module placeholders for Job Cards, Customers, Vehicles, Inventory and Billing.

---

## One-time setup

### 1. Register a Web App in Firebase (gets you the config keys)
Open <https://console.firebase.google.com/project/belt-kit/settings/general>:
- Scroll to **Your apps**. If there's no web app, click the **`</>`** (Web) icon.
- Give it a nickname (e.g. "Belt-Kit Web"), register — **skip** the hosting step.
- Copy the shown `firebaseConfig` values.

### 2. Create your env file
```bash
cd apps/web
copy .env.local.example .env.local      # Windows PowerShell:  cp .env.local.example .env.local
```
Open `.env.local` and paste in the values from step 1 (apiKey, appId, etc.).
Leave `NEXT_PUBLIC_USE_EMULATOR=false` to use real cloud, or set `true` for the emulator.

### 3. Install dependencies
```bash
npm install
```

### 4. Install Ollama for the Technician Assistant

The Technician Assistant is a real local AI feature. It uses Ollama on the
same computer as the Next.js app, so it does not send workshop questions to a
public AI provider.

1. Install Ollama from <https://ollama.com/download>. On Linux, you can use:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
2. Start Ollama (the desktop application, or `ollama serve` on Linux).
3. Download the required chat and retrieval models:
   ```bash
   ollama pull qwen3:4b
   ollama pull embeddinggemma
   ```
   To enable image analysis from the attachment button, also download the
   optional vision model:
   ```bash
   ollama pull qwen2.5vl:3b
   ```
4. Copy the Ollama variables from `.env.local.example` into `.env.local`.
   The defaults work when Ollama is on the same machine.
5. Verify before starting the web app:
   ```bash
   npm run ollama:check
   ```

For a deployed Next.js server, set the server-only
`FIREBASE_SERVICE_ACCOUNT_JSON` environment variable so the assistant API can
verify Firebase ID tokens. Local emulator development does not need this key.

The assistant will show an honest “Local AI unavailable” message when Ollama
or a required model is not running. It will not return hardcoded advice. Text
and Markdown attachments are included in the prompt; image interpretation
uses the optional vision model above.

---

## Create the default login accounts

The local app needs users to log in. The demo seed is deliberately restricted
to loopback Firebase emulators and never writes demo identities to production.
From the repository root run
`npm run dev`. It starts the emulators, safely seeds/repairs every demo account,
and then starts the web app. Emulator data is preserved between clean stops.

### Default credentials

| Role | Email | Password |
|---|---|---|
| Owner / Admin | `owner@beltkit.local` | `beltkit123` |
| Branch Manager | `manager@beltkit.local` | `beltkit123` |
| Service Advisor | `advisor@beltkit.local` | `beltkit123` |
| Technician | `tech@beltkit.local` | `beltkit123` |
| Accountant / Cashier | `accounts@beltkit.local` | `beltkit123` |
| Notification advisor | `notification-admin@test.com` | `beltkit123` |
| Local notification advisor | `local-notification-user@example.test` | `beltkit123` |

You can rename accounts and (with the role function) change roles from the **Users & Roles** screen once signed in as owner/manager. Change the password before going live.

---

## Run it locally

```bash
npm run dev
```
Open <http://localhost:3000>. You'll land on the login page — sign in with any account above.

Run this command from the repository root. It builds Functions, starts the
`belt-kit` Auth/Firestore/Functions emulators, actively waits for Auth and
Firestore, repairs all demo users and their claims/profiles, verifies every
login, and only then starts the frontend. The seed does not depend on saved
emulator data, although clean shutdowns are also exported to
`.firebase/emulator-data`.

For the full local prototype with the Technician Assistant, use three terminals:

```bash
# Terminal 1: Ollama
ollama serve

# Terminal 2: Firebase emulators
cd functions && npm run serve

# Terminal 3: Next.js web app
cd apps/web && npm run dev
```

After login, open **Technician Assistant** from the sidebar. Select a job card
and ask a repair question. The response is grounded with job, vehicle, current
inventory, and local workshop reference notes. Review all advice against the
manufacturer manual and workshop safety procedure.

---

## What works on the free tier vs. Blaze

- **Free (real cloud):** login, dashboard, viewing/editing user names, reading/writing Firestore records — all governed by your security rules.
- **Needs the emulator OR Blaze:** the Cloud Functions (`setUserRole`, `generateInvoice`, `bootstrapFirstOwner`). Until then, role *changes* and server-side invoice generation are shown in the UI but must run through the emulator. Everything else works against real cloud for free.

---

## Theme reference

- **Backgrounds:** blush ivory `#FBF7F4`, white surfaces — always light.
- **Primary:** burgundy `#6E1E3A`. **Accent:** rose gold `#B76E79` + champagne `#C6A15B`.
- **Fonts:** Cormorant Garamond (serif headlines), Jost (sans UI).
- Palette + shadows live in `tailwind.config.ts`; reusable component classes in `src/app/globals.css`.
