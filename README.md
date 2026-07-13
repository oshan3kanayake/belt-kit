# Belt-Kit — Backend (Phase 1 MVP)

Cloud-based ERP for automotive garages. This repository is the **Firebase backend** for the Phase 1 MVP: a single branch can run its daily operations end-to-end (staff logins with roles, job cards, customers, vehicles, basic inventory, and billing).

Firebase project: **`belt-kit`** (project number `973733896346`).

---

## What "backend" means here

You chose **Firebase all the way**, so there is no separate server to run. Your backend is four Firebase services working together:

| Piece | Firebase service | What it does |
|---|---|---|
| Database | **Firestore** | Stores customers, jobs, invoices, stock — as documents in collections. |
| Login & roles | **Firebase Auth** | Signs users in and remembers their role (owner, manager, technician…). |
| Business rules | **Cloud Functions** | Server-side code for things that must be trusted: assigning roles, generating invoices, writing the audit log. |
| Files | **Cloud Storage** | DVI photos, invoice PDFs, vehicle documents — never stored inside the database. |

The golden rule from the spec still holds: **the app never trusts the client.** Sensitive actions run in Cloud Functions, and the database is protected by security rules that enforce your role matrix even if someone bypasses the app.

---

## Folder map

```
belt-kit/
├── firebase.json            # Tells Firebase what to deploy + emulator ports
├── .firebaserc              # Points at your project (belt-kit)
├── firestore.rules          # RBAC enforced at the database level
├── firestore.indexes.json   # Query indexes for the app's list screens
├── storage.rules            # Who can read/write files, by branch
└── functions/               # Your server-side code (TypeScript)
    ├── src/
    │   ├── index.ts         # Entry point — registers all functions
    │   ├── types.ts         # THE DATA MODEL — every collection's shape
    │   ├── audit.ts         # Helper: write a tamper-proof audit entry
    │   ├── users.ts         # Assign roles / bootstrap the first owner
    │   ├── jobCards.ts      # Auto-audit when a job's status changes
    │   └── billing.ts       # Generate an invoice from a job card
    ├── package.json
    └── tsconfig.json
```

`functions/src/types.ts` is the most important file to read first — it documents every collection and field in plain TypeScript.

---

## The data model at a glance

Top-level Firestore collections (all Phase 1):

`branches` · `users` · `customers` · `vehicles` · `jobCards` · `jobCardLines` · `parts` · `stockMovements` · `invoices` · `payments` · `auditLog`

Four spec rules are baked in:

1. **Every record has `branchId`** — multi-branch safe from day one (you run one branch now; adding more later is a config change, not a rewrite).
2. **No hard deletes** — records carry an `archived` flag instead. Financial and job history stays intact.
3. **Money is stored in minor units** (e.g. cents) as whole numbers — avoids rounding bugs.
4. **Prices are frozen on the line item** (`unitPriceMinor`) — old invoices never change when you update a part's price later.

---

## The roles (RBAC)

A user's role lives in their Firebase Auth token as a "custom claim" that only the server can set. The security rules read it. Matching the spec's matrix:

| Role | Can do |
|---|---|
| `owner` | Everything, all branches. |
| `manager` | Everything within their branch. |
| `advisor` | View/create jobs, create/edit customers & vehicles, estimates. No financial actions. |
| `technician` | See only jobs assigned to them; change **job status only**. |
| `accountant` | View jobs; manage invoices & payments. No job editing. |
| `customer` | Portal only: read their own invoices, pay. |

---

## First-time setup (do this once)

You'll run these on **your own computer**, not here.

### 1. Install the tools
```bash
# Install Node.js 20 from nodejs.org first, then:
npm install -g firebase-tools
firebase login
```

### 2. Install the function dependencies
```bash
cd functions
npm install
cd ..
```

### 3. Turn on the services you need in the Firebase console
Open <https://console.firebase.google.com/project/belt-kit>:
- **Build → Firestore Database** → Create database → choose a location **close to your region** (⚠️ this is permanent) → start in *production mode* (our rules handle security).
- **Build → Authentication** → Get started → enable **Email/Password**.
- **Build → Storage** → Get started.
- To use Cloud Functions you must be on the **Blaze (pay-as-you-go)** plan. The free tier covers all your development — you just need a card on file.

---

## Running it locally (no cost, no internet needed)

Firebase ships an **emulator suite** — a full local copy of Firestore, Auth, Functions and Storage. Build against this while learning; nothing touches your real project.

```bash
cd functions
npm run serve
```

Then open the emulator dashboard at <http://localhost:4000>. You can create test users, watch documents appear, and see function logs live.

---

## Creating your first login (the bootstrap step)

Chicken-and-egg problem: you need an owner to assign roles, but no owner exists yet. Solve it once:

1. In the Auth emulator (or the real console), create a user with your email/password.
2. Sign in as that user from your app (or the emulator) and call the **`bootstrapFirstOwner`** function with a branch, e.g.:
   ```js
   // pseudo-code from your future frontend
   const fn = httpsCallable(functions, "bootstrapFirstOwner");
   await fn({ branchId: "main", branchName: "My Garage", currency: "LKR", timezone: "Asia/Colombo" });
   ```
3. Sign out and back in so your token picks up the new `owner` role.

From then on, you (the owner) add staff by calling **`setUserRole`** with their uid, role and branch. `bootstrapFirstOwner` refuses to run a second time once an owner exists.

---

## The functions you have

| Function | Type | Purpose |
|---|---|---|
| `bootstrapFirstOwner` | callable | One-time: make yourself the owner and create your branch. |
| `setUserRole` | callable | Owner/manager assigns a role + branch to a staff member. |
| `generateInvoice` | callable | Turns a job card + its line items into a frozen, tax-applied invoice. Owner/manager/accountant only. |
| `onJobCardStatusChange` | trigger | Fires automatically on status changes; writes an audit entry. |

---

## Deploying (when you're ready to go live)

```bash
# Deploy just the rules first (safe, instant):
firebase deploy --only firestore:rules,storage

# Deploy functions (requires Blaze plan):
firebase deploy --only functions

# Or everything:
firebase deploy
```

---

## What's next (Phase 1 to finish, then Phase 2)

Still to build on top of this backend:
- **Estimates → job card conversion** and stock deduction when parts are used (writes a `stockMovements` record + decrements `parts.quantityOnHand`).
- **Payments** reducing an invoice's `amountPaidMinor` and flipping status to `part_paid` / `paid`.
- The **web app** (`apps/web`, Next.js) and **technician mobile app** — the frontends that call all of the above.

Phase 2 (per the spec roadmap) adds Scheduling, DVI, Notifications and Payment gateways.

> This backend was scaffolded to match the Belt-Kit Master Specification v1.0, adapted from the spec's Postgres/NestJS design to a Firebase architecture.
