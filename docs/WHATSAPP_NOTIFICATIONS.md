# WhatsApp Notifications

## Trial Scope

GASS sends WhatsApp text messages through the internal EVA WhatsApp Consolidation Service. WhatsApp is additive to email and must never determine whether a booking transaction succeeds.

The current trial sends to `booking.phone_number` for these requester events:

- Meeting request fully approved.
- Meeting or accommodation request rejected.
- Meeting room reassigned.
- Two-hour booking confirmation.
- Ten-minute check-in reminder.
- Ten-minute check-out reminder.
- Manual or automatic checkout completion.

Manager and administrator approval notifications remain email-only until their user master records contain verified WhatsApp numbers.

## Runtime Configuration

Set these values only in the backend runtime `.env`:

```env
WHATSAPP_ENABLED=true
WHATSAPP_GATEWAY_BASE_URL=http://10.0.29.47:9009/api/v1
WHATSAPP_GATEWAY_API_KEY=<application-specific-api-key>
WHATSAPP_GATEWAY_PROVIDER=eva
WHATSAPP_GATEWAY_TIMEOUT_SECONDS=10
```

Never place the API key in Git, frontend configuration, application logs, database documents, screenshots, or documentation.

The API key should belong to a dedicated GASS application and require only the scopes used by GASS. A trial key copied into chat or a ticket must be rotated before production use.

## Delivery Contract

GASS calls `POST /api/v1/messages/send` with:

- Header `X-Api-Key`.
- A normalized recipient number such as `62812...`.
- Message type `text`.
- Booking ID as `metadata.referenceId`.
- A stable event name in metadata.
- A deterministic idempotency key in the form `gass:<booking-id>:<event>`.

Room reassignments include the reassignment timestamp in the idempotency key so multiple legitimate room changes can each notify the requester.

HTTP `202` with status `PENDING` means the gateway accepted the request. It does not prove delivery to the recipient. During the trial, the gateway message ID and accepted status are logged without logging the API key or full recipient number.

## Failure Behavior

- Missing configuration or blank/invalid phone number skips WhatsApp without failing the booking.
- HTTP authentication, validation, provider, and network failures are logged by error code.
- Email behavior and its existing retry markers remain unchanged.
- Scheduler retries reuse the same WhatsApp idempotency key, preventing duplicate messages at the gateway.

## Verification

1. From the backend host, verify `/health` and `/health/ready`.
2. Call `/api/v1/auth/me` and confirm the API key belongs to the intended tenant and GASS application.
3. Send a trial message to an approved test number.
4. Capture the returned `messageId` and confirm `PENDING` through `GET /api/v1/messages/{id}`.
5. Inspect `GET /api/v1/messages/{id}/events` for provider delivery events.
6. Repeat the same event with the same idempotency key and verify the recipient does not receive a duplicate.
7. Confirm booking approval and reminders still complete when the gateway is unavailable.
