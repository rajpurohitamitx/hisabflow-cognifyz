# HisabFlow — Cognifyz Tasks 1–6

**HisabFlow** is a small-shop credit follow-up assistant. It is designed around one practical question:

> **“I have money stuck in credit. Who should I follow up with today, and why?”**

This is one coherent full-stack product, not six unrelated mini-projects. The implementation covers **exactly Cognifyz Tasks 1–6**.

## Product flow

`Create shop → Add customers → Record credit/payment → Today's Follow-ups → Understand why → View ledger → Remind on WhatsApp → Daily Closing`

## What makes the project explainable

- **Today's Follow-ups** uses simple visible rules based on outstanding amount and time since payment. There is no unexplained AI score.
- **Quick sentence entry** turns a sentence such as “Ramesh took notebooks for 240 and paid 100” into a reviewable transaction preview. Nothing is saved until the shopkeeper confirms it.
- **WhatsApp reminder** uses a normal pre-filled WhatsApp link. It does not pretend to be a WhatsApp API integration.
- **Shop isolation** is enforced on the server. Every customer and transaction query is scoped to the authenticated shop.

## Cognifyz mapping

| Task | What this project demonstrates |
|---|---|
| 1 | HTML forms, Node.js, Express routes and EJS server-rendered pages |
| 2 | Client/server validation and a short-lived in-memory transaction draft before confirmation |
| 3 | Bootstrap, responsive CSS, mobile-first layout, transitions and interaction states |
| 4 | Password-strength validation, dynamic DOM updates, Fetch interactions and hash-based entry-mode routing |
| 5 | REST API, customer/transaction CRUD and frontend `fetch()` integration |
| 6 | MongoDB/Mongoose, bcrypt password hashing, JWT authentication, protected APIs and shop-level authorization |

## Tech stack

Node.js · Express · EJS · Bootstrap 5 · Vanilla JavaScript · MongoDB/Mongoose · bcrypt · JWT · Helmet · Morgan

The UI intentionally uses ordinary HTML, CSS and vanilla JavaScript around Bootstrap rather than a large framework. That keeps the code understandable for an internship interview.

## Run locally

1. Install Node.js 18+ and MongoDB.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI` and a JWT secret of at least 32 characters.
4. Run `npm install`.
5. Optional demo data: `npm run seed`.
6. Start: `npm start`.
7. Open `http://localhost:3000`.

Never commit `.env` or real credentials.

## Security decisions worth explaining

- Passwords are never stored directly; bcrypt stores a password hash.
- The JWT is stored in an HTTP-only cookie.
- API routes reject requests without a valid authenticated shop.
- A customer/transaction lookup always includes the authenticated `shopId`.
- The natural-language preview is temporary and expires after 10 minutes.
- Browser validation improves usability; server validation remains the final authority.

## Demo account isolation test

Create Shop A and Shop B. Add a customer to Shop A. While signed in as Shop B, request the Shop A customer through the API. The scoped query should not return Shop A's record.

## Important scope note

This version intentionally stops at **Tasks 1–6**. OAuth, SMS provider integration, Redis, background queues and caching are not part of the project scope.
