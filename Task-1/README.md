# Task 1 — Forms, Express and EJS

## Requirement covered
HTML forms, Node.js/Express, form submission endpoints and server-side rendering with EJS.

## HisabFlow implementation
- `views/auth/register.ejs` — shop registration form.
- `views/auth/login.ejs` — sign-in form.
- `views/transactions/entry.ejs` — transaction entry screen.
- `routes/auth.js` — registration and login endpoints.
- `routes/web.js` — authenticated EJS page routes.
- `server.js` — Express application, middleware and route setup.

## Demo flow
Open `/auth/register` → enter shop details → submit the form → Express validates the request → the account is stored in MongoDB → the user is redirected to the dashboard.

## What I would explain in an interview
EJS renders the page on the server. The REST API used by the interactive parts of the application is kept separate from the normal EJS page routes.
