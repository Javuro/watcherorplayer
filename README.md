# Watcher or Player

Watcher or Player is the first campaign app for JAVURO: a wallet-first Proof-of-Presence arena for the AI era.

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

- Next.js app shell.
- Campaign constants and reward rules.
- City and role selection UI.
- Local mock wallet generation.
- Local First Signal claim state.
- Mock transaction hash display.

This lets the team test the product loop before connecting thirdweb, Supabase, and the Reward Wallet.

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
- Database and storage: Supabase.
- Wallets and Web3 UX: thirdweb embedded wallet plus external wallet support.
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

1. Add thirdweb wallet connection and replace mock wallet generation.
2. Add Supabase tables for users, city selections, roles, rewards, proof logs, and referrals.
3. Move local First Signal state into Supabase.
4. Add backend reward engine with dry-run mode.
5. Add Reward Wallet transfers on BNB Chain for First Signal claims.
6. Add admin pause, caps, and manual claim review.
