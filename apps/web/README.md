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

---

## Create the default login accounts

The app needs users to log in. Seed the five role accounts (owner, manager,
advisor, technician, accountant) with a shared demo password.

**Against real cloud** (what you chose):
1. Firebase console → **Project settings → Service accounts → Generate new private key**.
2. Save the downloaded file as `functions/serviceAccountKey.json` (this file is gitignored — never commit it).
3. Run:
   ```bash
   cd ../../functions
   npm run seed:cloud
   ```

**Against the emulator** (free, no key needed): start `npm run serve` in `functions/`, then in another terminal run `npm run seed`.

### Default credentials

| Role | Email | Password |
|---|---|---|
| Owner / Admin | `owner@beltkit.local` | `beltkit123` |
| Branch Manager | `manager@beltkit.local` | `beltkit123` |
| Service Advisor | `advisor@beltkit.local` | `beltkit123` |
| Technician | `tech@beltkit.local` | `beltkit123` |
| Accountant / Cashier | `accounts@beltkit.local` | `beltkit123` |

You can rename accounts and (with the role function) change roles from the **Users & Roles** screen once signed in as owner/manager. Change the password before going live.

---

## Run it

```bash
cd apps/web
npm run dev
```
Open <http://localhost:3000>. You'll land on the login page — sign in with any account above.

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
