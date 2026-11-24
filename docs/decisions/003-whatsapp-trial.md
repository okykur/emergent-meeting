# ADR 003: WhatsApp Is A Best-effort Trial Channel

- Status: Accepted for trial
- Date: 2026-11-24

## Context

GASS requires faster requester notifications in addition to transactional email. An internal EVA WhatsApp gateway accepts application API keys and asynchronous message requests.

## Decision

Add WhatsApp as a backend-only, best-effort channel for requester-facing meeting events. Email remains the primary channel. WhatsApp failures do not roll back booking state transitions, and scheduler retries use deterministic idempotency keys.

The trial uses only the phone number already stored on the booking. Approval messages to managers and administrators are excluded until their master records contain verified WhatsApp numbers.

## Consequences

- Requesters can receive time-sensitive meeting updates through WhatsApp.
- A `202 PENDING` response must not be treated as delivered.
- Production use requires a dedicated GASS API key, private network connectivity, delivery monitoring, and key rotation.
- Delivery audit persistence and verified manager phone numbers remain follow-up work after the trial.
