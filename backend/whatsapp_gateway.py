import hashlib
import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen


logger = logging.getLogger("gass.whatsapp")

WHATSAPP_ENABLED = os.environ.get("WHATSAPP_ENABLED", "false").strip().lower() == "true"
WHATSAPP_GATEWAY_BASE_URL = os.environ.get("WHATSAPP_GATEWAY_BASE_URL", "").strip().rstrip("/")
WHATSAPP_GATEWAY_API_KEY = os.environ.get("WHATSAPP_GATEWAY_API_KEY", "").strip()
WHATSAPP_GATEWAY_PROVIDER = os.environ.get("WHATSAPP_GATEWAY_PROVIDER", "eva").strip() or "eva"
WHATSAPP_GATEWAY_TIMEOUT_SECONDS = max(
    1,
    int(os.environ.get("WHATSAPP_GATEWAY_TIMEOUT_SECONDS", "10")),
)


@dataclass(frozen=True)
class WhatsAppSendResult:
    accepted: bool
    message_id: Optional[str] = None
    status: Optional[str] = None
    error_code: Optional[str] = None
    skipped: bool = False


def whatsapp_is_configured() -> bool:
    return bool(WHATSAPP_ENABLED and WHATSAPP_GATEWAY_BASE_URL and WHATSAPP_GATEWAY_API_KEY)


def normalize_whatsapp_recipient(value: str) -> str:
    raw = (value or "").strip()
    if raw.startswith("+"):
        raw = raw[1:]
    digits = re.sub(r"\D", "", raw)
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0"):
        digits = f"62{digits[1:]}"
    elif digits.startswith("8"):
        digits = f"62{digits}"
    if not 10 <= len(digits) <= 15:
        raise ValueError("WhatsApp recipient must contain 10 to 15 digits")
    return digits


def _idempotency_key(reference_id: str, event: str) -> str:
    raw = f"gass:{reference_id}:{event}"
    if len(raw) <= 120:
        return raw
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"gass:{digest}"


def _safe_error_details(payload: bytes) -> tuple[Optional[str], Optional[str]]:
    try:
        body = json.loads(payload.decode("utf-8", errors="replace"))
    except (TypeError, ValueError):
        return None, None
    error = body.get("error") if isinstance(body, dict) else None
    error_code = error.get("code") if isinstance(error, dict) else None
    request_id = body.get("requestId") if isinstance(body, dict) else None
    return error_code, request_id


def send_whatsapp_text(
    recipient: str,
    text: str,
    reference_id: str,
    event: str,
    *,
    idempotency_key: Optional[str] = None,
) -> WhatsAppSendResult:
    if not whatsapp_is_configured():
        return WhatsAppSendResult(accepted=False, error_code="NOT_CONFIGURED", skipped=True)

    try:
        normalized_recipient = normalize_whatsapp_recipient(recipient)
    except ValueError:
        logger.warning("WhatsApp notification skipped because the recipient number is invalid")
        return WhatsAppSendResult(accepted=False, error_code="INVALID_RECIPIENT", skipped=True)

    payload = {
        "recipient": normalized_recipient,
        "type": "text",
        "content": {"text": text},
        "metadata": {
            "referenceId": reference_id,
            "event": event,
        },
        "idempotencyKey": idempotency_key or _idempotency_key(reference_id, event),
        "provider": WHATSAPP_GATEWAY_PROVIDER,
    }
    request = UrlRequest(
        f"{WHATSAPP_GATEWAY_BASE_URL}/messages/send",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "X-Api-Key": WHATSAPP_GATEWAY_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "GASS/1.0",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=WHATSAPP_GATEWAY_TIMEOUT_SECONDS) as response:
            response_body = response.read()
            if response.status != 202:
                logger.error("WhatsApp gateway returned unexpected status %s", response.status)
                return WhatsAppSendResult(accepted=False, error_code="UNEXPECTED_STATUS")
            try:
                result = json.loads(response_body.decode("utf-8"))
            except (TypeError, ValueError):
                result = {}
            data = result.get("data") if isinstance(result, dict) else {}
            message_id = data.get("messageId") if isinstance(data, dict) else None
            status = data.get("status") if isinstance(data, dict) else None
            logger.info(
                "WhatsApp notification accepted for reference %s with message id %s",
                reference_id,
                message_id or "unknown",
            )
            return WhatsAppSendResult(accepted=True, message_id=message_id, status=status)
    except HTTPError as error:
        response_body = error.read(2048)
        error_code, request_id = _safe_error_details(response_body)
        logger.error(
            "WhatsApp gateway rejected request with status %s, code %s, request id %s",
            error.code,
            error_code or "unknown",
            request_id or "unknown",
        )
        return WhatsAppSendResult(accepted=False, error_code=error_code or f"HTTP_{error.code}")
    except URLError:
        logger.exception("Unable to reach WhatsApp gateway")
        return WhatsAppSendResult(accepted=False, error_code="NETWORK_ERROR")
    except Exception:
        logger.exception("Unexpected WhatsApp gateway error")
        return WhatsAppSendResult(accepted=False, error_code="UNEXPECTED_ERROR")
