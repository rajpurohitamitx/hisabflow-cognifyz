# HisabFlow — Cognifyz Full Stack Development Internship

HisabFlow is a credit ledger (khata) for small shops. A shopkeeper can type an entry the way they would say it —
*“Meena took 2 kg sugar at 45 and a litre of oil for 130, paid 100”* — and HisabFlow splits it into items,
quantities, rates and a payment, shows a preview, and saves it to the customer's ledger after confirmation.
It also ranks customers with pending credit so the shopkeeper knows who to follow up with each day.

**Live demo:** https://hisabflow-cogni.vercel.app/

This repository covers **Cognifyz Tasks 1–6** as one connected application (the internship requires at least 5 of 8).

## Cognifyz task coverage

| Task | Where it lives in HisabFlow |
|---|---|
| 1 — HTML forms, Express, EJS | `views/**`, `routes/web.js`, `routes/auth.js`, `server.js` |
| 2 — Validation + temporary server-side storage | Browser checks in `public/js/app.js`; server checks in `routes/*.js`; signed 10-minute drafts in `services/draftStore.js` |
| 3 — Responsive UI, CSS, Bootstrap | Bootstrap 5 + `public/css/app.css` (transitions, responsive tables and layouts) |
| 4 — Complex validation, DOM updates, client-side routing | Password-strength meter, live search, DOM-built entry preview, hash router for `/entry#natural` / `#structured` |
| 5 — REST API + front-end fetch | `routes/api.js` (CRUD for customers and transactions) consumed with `fetch()` |
| 6 — Database + authentication + authorization | MongoDB/Mongoose, bcrypt, JWT in an HTTP-only cookie, every query scoped by `shopId` |

Each `Task-N/README.md` explains the task in more detail. Tasks 7 and 8 are not part of this submission.

## Natural-language entry

`services/naturalLanguage.js` is a rule-based parser (no external AI service). It understands, for example:

- `Ramesh took notebooks for 240 and paid 100`
- `Meena bought 2 kg sugar at 45 and 1 litre oil 130, paid 100`
- `3 notebooks at 40 each for Ravi`  ·  `Hari took 2 soaps x 35 and shampoo 120`
- `received 500 from Anita`  ·  `Kumar udhaar 250`  ·  `Priya cleared her dues`
- Amounts as `₹240`, `Rs. 240`, `240 rupees`, `1,200`, `2k`; quantities with kg, g, L, ml, packet, dozen, pcs…

Customer names already in the shop's list are matched first (even by first name). Anything unclear produces a specific
message instead of a wrong entry, and nothing is saved until the user confirms the preview. It is a heuristic parser, not
a language model, so very unusual phrasing may need rewording — the preview exists for that reason.

## Security notes

- Passwords hashed with bcrypt (cost 12); 72-byte limit enforced; login compares against a dummy hash for unknown emails.
- JWT (HS256 pinned, 3-day expiry) in an HTTP-only, `SameSite=Lax`, `Secure`-in-production cookie.
- Every API query is scoped to the signed-in shop; cross-shop ids return 404.
- Server-side validation of all input (types, lengths, amount range, dates, ObjectIds).
- Content-Security-Policy, HSTS and other headers via Helmet; `X-Powered-By` disabled; small body-size limits.
- Same-origin check on state-changing requests; rate limiting on sign-in/registration, the API and the parser
  (in-memory, so per serverless instance — use a shared store such as Redis for strict global limits).
- Signed, shop-bound, expiring preview tokens instead of in-memory state (which fails on serverless hosting).
- Secrets only in environment variables; failed logins, blocked requests and rate-limit hits are logged without passwords.

Known limits: no email verification or password reset yet, and no account deletion screen.

## Run locally

```bash
npm install
cp .env.example .env      # set MONGODB_URI and a random JWT_SECRET (32+ chars)
npm start                 # http://localhost:3000
npm test                  # parser, ranking rules, signed drafts, rate limiter
npm run seed              # optional demo data (demo@hisabflow.local)
```

Deployment notes for Vercel are in `VERCEL-DEPLOY.md`.

## Project structure

`server.js` app + Vercel handler · `routes/` web, auth, REST API · `models/` Mongoose schemas ·
`middleware/` auth, rate limit, origin check · `services/` parser, ranking rules, balances, signed drafts ·
`views/` EJS · `public/` CSS, JS, icons · `tests/` · `Task-1/`…`Task-6/` task notes

This is an internship prototype, not a production financial record system.
