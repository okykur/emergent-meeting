---
paths:
  - "backend/**/*.py"
  - "backend/**/*.sql"
---

# Backend Rules

- Preserve FastAPI authorization checks for every protected operation; frontend visibility is not security.
- Use `PostgresDatabase`/the existing compatibility layer instead of adding MongoDB runtime dependencies.
- Keep business timing in Asia/Jakarta and use timezone-aware datetime handling.
- Treat approval, check-in/out, reminders, and email sends as idempotent state transitions.
- Validate allowed source status before every transition and reject stale/repeated actions safely.
- Keep stored role values stable; `manager` is displayed as Manager GA and `manager_user` is distinct.
- Escape user-provided values in email HTML and never expose approval tokens in logs.
- Add focused tests for success, forbidden role, invalid state, ordering, and duplicate invocation.
