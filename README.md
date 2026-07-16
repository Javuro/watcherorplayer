# Watcher or Player

Watcher or Player is the first campaign app for JAVURO: a Proof-of-Presence arena for the AI era.

The project starts as a Genesis Claim and participation loop, not as the full JAVURO app. The first job is to create verified wallets, distribute a small amount of JXRO, collect repeat participation data, and turn Player proof logs into content Watchers can consume.

## V1 Scope

- Connect or create a wallet.
- Choose a city.
- Choose a role: Watcher or Player.
- Claim the First Signal reward.
- Complete daily actions for Signal Points.
- Let Players submit Proof Logs.
- Let Watchers judge Proof Logs as Real or Noise.
- Track referrals, streaks, city activity, and snapshot eligibility.

## Current Implementation

- Next.js 16 app shell and MapLibre signal globe.
- Google authentication with Firebase Authentication.
- Opaque, hashed server sessions stored in PostgreSQL.
- PostgreSQL data model with Prisma.
- Admin-only account registry at `/admin`.
- Database models for users, wallets, claims, proofs, and reactions.
- City and role selection UI.
- Automatic removal of the previous browser-only mock state.

Wallet linking, image storage, and token transfers are intentionally not active yet.
The interface never creates a fake wallet or fake transaction hash.

## Local Setup

Copy `.env.example` to `.env.local`, then provide:

- `DATABASE_URL`: Railway PostgreSQL connection string.
- `ADMIN_EMAILS`: comma-separated Google accounts allowed to open `/admin`.
- `NEXT_PUBLIC_FIREBASE_*`: Firebase web app configuration values.

Apply the schema and start the app:

```bash
npm run db:deploy
npm run dev
```

Enable the Google provider in Firebase Authentication and add the production
host to Firebase Authorized domains. A custom Firebase action domain such as
`auth.javuro.com` can be added later; the default Firebase action URL works for
the MVP.

Add the same variables to the Railway service. Link a Railway PostgreSQL
service so `DATABASE_URL` is available. The production start command applies
pending Prisma migrations automatically. The browser sends a Firebase ID token to the app,
the server verifies it with Firebase, and then issues its own HttpOnly session
cookie. Raw server session tokens are never stored in the database.

## Reward Model

Initial public phase:

- First Signal Claim: 100 JXRO, once per wallet.
- Phase 1 cap: first 10,000 wallets.
- Total Phase 1 JXRO pool: 1,000,000 JXRO.
- Daily Watcher, Daily Player, Proof Log, and referral actions start as Signal Points.

Later expansion:

- Daily Watcher: 1 JXRO.
- Daily Player: 3 JXRO.
- Verified Proof: +7 JXRO.
- 7-Day Streak: +20 JXRO.

## Product Loop

```text
Enter Arena
-> Connect/Create Wallet
-> Choose City
-> Choose Watcher or Player
-> Claim First Signal
-> Receive 100 JXRO
-> Daily Signal / Proof Log / Invite
-> Signal Points
-> Snapshot Eligibility
-> JAVURO Founder Layer
```

## Technical Direction

- App: Next.js, TypeScript, Tailwind CSS.
- Authentication: Firebase Authentication with Google sign-in.
- App session: hashed opaque session tokens in PostgreSQL.
- Database: Railway PostgreSQL with Prisma.
- Image storage: Cloudflare R2 or an S3-compatible service.
- Wallets and Web3 UX: wagmi, viem, and RainbowKit.
- Chain: BNB Smart Chain.
- Token: JXRO BEP-20.
- V1 distribution: backend-verified Reward Wallet transfers.
- Later distribution: claim contract with signed vouchers.

## Map Provider

The Map tab uses MapLibre GL JS with globe projection and a keyless OpenFreeMap light style. It supports Earth-to-city zoom and city signal markers without an API key. Review tile capacity and service terms before public launch, then replace the style URL if a dedicated production provider is required.

## Safety Rules

- Never place the treasury private key on the server.
- Use a separate Reward Wallet funded only with campaign-sized amounts.
- Enforce wallet, IP, device, campaign, and daily caps.
- Keep admin pause controls available.
- Store reward transaction hashes and claim state.

## Next Build Order

1. Add Railway PostgreSQL and Firebase environment variables.
2. Link Railway PostgreSQL and run `npm run db:deploy`.
3. Add BNB Chain wallet connection and signed ownership verification.
4. Save role and city selections to the authenticated user record.
5. Add R2 image upload and database-backed Signal feed.
6. Add the claim ledger and admin approval flow.
7. Add Reward Wallet transfers on BNB Chain after dry-run verification.
