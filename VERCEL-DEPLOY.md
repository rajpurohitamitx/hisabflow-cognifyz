# HisabFlow — Vercel deployment (Tasks 1–6)

This repository is **one Express application** containing Cognifyz Tasks 1–6. Do not deploy each task separately.

## 1. GitHub

Upload the **contents of this folder** to the root of your GitHub repository. `package.json`, `server.js`, `vercel.json`, `views/`, `routes/`, `models/`, `public/`, etc. must be at the repository root.

## 2. Vercel

Import the GitHub repository as one Vercel project.

Framework preset: **Other**
Build command: leave empty/default
Output directory: leave empty/default
Install command: `npm install`

The included `vercel.json` sends all requests to the Express handler in `server.js`.

## 3. Environment variables

Add these in Vercel → Settings → Environment Variables:

- `MONGODB_URI` = your MongoDB Atlas connection string
- `JWT_SECRET` = a random secret of at least 32 characters
- `NODE_ENV` = `production`

Apply them to **Production** (and Preview if you want preview deployments to work).

## 4. Redeploy

After adding the variables, deploy the latest commit again.

## 5. First test

Open the production domain and:

1. Create a shop account.
2. Sign in.
3. Add a customer.
4. Add a credit transaction.
5. Add a payment.
6. Open Today's Follow-ups.
7. Open Daily Closing.

## Important

MongoDB Atlas must allow Vercel's connections. For a temporary student demo, Atlas Network Access can use `0.0.0.0/0`; use a strong database password and do not commit the connection string.
