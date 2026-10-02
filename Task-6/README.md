# Task 6 — MongoDB + authentication + authorization

## Requirement covered
Database storage/retrieval, authentication, secure API endpoints, authorization checks.

## Implementation
- MongoDB via Mongoose.
- Passwords hashed with bcrypt.
- JWT stored in an HTTP-only cookie.
- `requireApiAuth` protects `/api` routes.
- Every customer and transaction query includes `shopId: req.shop._id`.

## Security demo
Create two shop accounts. Add a customer to Shop A. While authenticated as Shop B, try the Shop A customer id through the API. The scoped query should return not found rather than exposing Shop A's record.
