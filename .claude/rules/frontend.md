---
paths:
  - "frontend/src/**/*.{js,jsx,css}"
---

# Frontend Rules

- Preserve the established GASS visual language and responsive behavior.
- Reuse existing approval, table, status badge, searchable selector, and modal patterns before introducing variants.
- Never rely on hidden buttons for authorization; handle backend 401/403 responses clearly.
- Display complete booking IDs, role labels, status labels, job titles, and other operational text without truncating required information.
- Keep `manager` labeled Manager GA and `manager_user` labeled Manager User.
- Searchable master selectors must support keyboard use, visible full option names, codes, and `Others` where the workflow allows it.
- Add/update component tests for changed states and run the production build before release.
