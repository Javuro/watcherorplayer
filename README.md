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

## Safety Rules

- Never place the treasury private key on the server.
- Use a separate Reward Wallet funded only with campaign-sized amounts.
- Enforce wallet, IP, device, campaign, and daily caps.
- Keep admin pause controls available.
- Store reward transaction hashes and claim state.
