# Task 4 — Validation + DOM + client-side routing

## Requirement covered
Complex validation, password-strength interaction, dynamic DOM manipulation and client-side routing/interaction.

## HisaabFlow implementation
- Registration shows a live password-strength meter and enforces the same rules on the server.
- Customer search filters the table in the browser without a reload.
- The quick-sentence parser creates the preview card dynamically with DOM APIs.
- The transaction and customer forms use `fetch()` and update the page from the returned JSON.
- `/entry#structured` and `/entry#natural` act as a small hash-based client-side router for the two entry modes.

## Interview point
The browser handles immediate feedback and small UI changes; the Express API remains responsible for trusted validation and persistence.
