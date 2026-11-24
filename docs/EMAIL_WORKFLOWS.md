# Email Workflows

## Provider And Configuration

Transactional email is sent through Resend.

- `RESEND_API_KEY`: API credential.
- `RESEND_FROM`: verified sender address/name.
- Application/base URL variables: used to build login and approval links.

Never log or commit email credentials or approval tokens.

## Event Matrix

| Event | Recipient | Outcome |
| --- | --- | --- |
| User registers | Requester | Account request is awaiting approval |
| User registers | Super Admin users | New account activation request |
| Account approved | Requester | Account approved with login action |
| Account rejected | Requester | Account rejected with reason |
| Meeting submitted | Meeting Admin users | New meeting approval request |
| Manager step assigned | Manager User or Manager GA | Approval request with approve/reject actions |
| Meeting fully approved | Requester | Room booking approved |
| Meeting rejected | Requester | Room booking rejected with reason |
| Room reassigned | Requester | Previous room and new room details |
| Two hours before start | Requester | Booking confirmation reminder |
| Ten minutes before start | Requester | Check-in reminder |
| Ten minutes before end | Requester | Check-out reminder when in progress |
| Manual/auto check-out | Requester | Meeting completed confirmation |

## Template Rules

- Use the established GASS card layout and role/event-specific header colors.
- Include only information needed for the decision or notification.
- Escape all user-provided values before inserting them into HTML.
- Render dates and times in Asia/Jakarta.
- Use the booking ID in the subject or content where it helps tracing.
- Reject actions must require a reason before recording the decision.
- Approve/reject links must be signed, expire appropriately, and be safe to invoke only once.

## Images And Attachments

Resend rejects attachment paths that are not publicly accessible. For the GASS logo, prefer a stable public HTTPS image URL in the HTML or valid inline content. Do not send a local path or private URL as an attachment.

## Reliability

- Persist a sent marker for scheduled messages.
- Set the marker only in coordination with a successful send, with retry behavior that avoids duplicates.
- Log the event type, booking ID, recipient domain, provider message ID, and failure category; do not log tokens or full sensitive payloads.
- Email failure must be visible for operations and retryable without repeating the underlying approval/state transition.
- Test sends must use an explicitly supplied recipient and must not notify real workflow participants accidentally.
