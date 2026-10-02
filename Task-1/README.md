# Task 1 — Forms + Express + EJS

## Requirement covered
HTML forms, Node.js/Express server, form submission endpoints, server-side rendering with EJS.

## HisabFlow implementation
- `app/views/auth/register.ejs` — HTML/EJS registration form.
- `app/views/transactions/entry.ejs` — transaction form.
- `app/routes/auth.js` — POST registration/login endpoints.
- `app/routes/web.js` — EJS page routes.
- `app/server.js` — Express application and body parsing.

## Demo flow
Open `/auth/register` → submit shop details → Express validates → MongoDB stores account → redirect to `/dashboard`.

## Interview point
Explain that EJS renders server-side HTML while the REST endpoints later provide JSON to the interactive frontend.
