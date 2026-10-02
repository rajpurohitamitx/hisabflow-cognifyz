# Task 2 — Validation + temporary storage

## Requirement covered
Complex forms, client-side validation, server-side validation and temporary server-side storage.

## HisabFlow implementation
- Registration validates required fields, email format and password rules in both the browser and Express.
- Transaction and customer forms use browser feedback before making a request.
- Express validates every customer, transaction and amount again on the server.
- The quick-sentence feature stores its parsed preview in a short-lived in-memory draft store for 10 minutes. The transaction is only written to MongoDB after confirmation.

## Interview point
Client-side validation is for fast user feedback. Server-side validation is the trusted boundary. The temporary draft is useful because the user can review a parsed entry without immediately changing the ledger.
