# ADR 002: Sequential Meeting Approval

- Status: Accepted
- Date: 2026-10

## Context

Meeting requests may require operational review plus requester-management and GA approval. Independent approvals allowed actions in the wrong order and made notifications/statuses difficult to reason about.

## Decision

Use a sequential approval chain:

1. Meeting Admin reviews every request.
2. Meeting Admin optionally selects Manager User, Manager GA, or both.
3. Manager User acts first when selected.
4. Manager GA acts after Manager User when both are selected.
5. A rejection ends the chain.
6. The booking becomes confirmed only after all required steps approve.

## Consequences

- The current actionable approver is deterministic.
- Email notifications are sent only when a step becomes active.
- Manager GA cannot approve early when Manager User is required.
- Approval records need actor, decision, reason, and timestamp audit data.
- UI status must distinguish pending, active, approved, rejected, and waiting-for-previous-step states.
