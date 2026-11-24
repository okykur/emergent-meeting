import json
import unittest
from unittest.mock import patch

import whatsapp_gateway


class FakeResponse:
    status = 202

    def __init__(self, body: dict):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self):
        return json.dumps(self.body).encode("utf-8")


class WhatsAppGatewayTests(unittest.TestCase):
    def test_normalizes_indonesian_phone_numbers(self):
        self.assertEqual(whatsapp_gateway.normalize_whatsapp_recipient("0812-3456-7890"), "6281234567890")
        self.assertEqual(whatsapp_gateway.normalize_whatsapp_recipient("+62 812 3456 7890"), "6281234567890")
        self.assertEqual(whatsapp_gateway.normalize_whatsapp_recipient("81234567890"), "6281234567890")

    def test_invalid_recipient_is_rejected(self):
        with self.assertRaises(ValueError):
            whatsapp_gateway.normalize_whatsapp_recipient("123")

    def test_disabled_gateway_skips_request(self):
        with patch.object(whatsapp_gateway, "WHATSAPP_ENABLED", False), patch.object(
            whatsapp_gateway, "urlopen"
        ) as request:
            result = whatsapp_gateway.send_whatsapp_text("081234567890", "Test", "MR2611240001", "approved")

        self.assertFalse(result.accepted)
        self.assertTrue(result.skipped)
        request.assert_not_called()

    def test_send_uses_api_key_and_deterministic_idempotency(self):
        captured = {}

        def fake_urlopen(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return FakeResponse(
                {
                    "success": True,
                    "message": "Message accepted for processing",
                    "data": {"messageId": "message-uuid", "status": "PENDING"},
                }
            )

        with patch.object(whatsapp_gateway, "WHATSAPP_ENABLED", True), patch.object(
            whatsapp_gateway, "WHATSAPP_GATEWAY_BASE_URL", "http://gateway.test/api/v1"
        ), patch.object(whatsapp_gateway, "WHATSAPP_GATEWAY_API_KEY", "test-api-key"), patch.object(
            whatsapp_gateway, "WHATSAPP_GATEWAY_PROVIDER", "eva"
        ), patch.object(whatsapp_gateway, "urlopen", side_effect=fake_urlopen):
            result = whatsapp_gateway.send_whatsapp_text(
                "081234567890",
                "Booking approved",
                "MR2611240001",
                "meeting-approved",
            )

        request = captured["request"]
        payload = json.loads(request.data.decode("utf-8"))
        headers = {key.lower(): value for key, value in request.header_items()}

        self.assertTrue(result.accepted)
        self.assertEqual(result.message_id, "message-uuid")
        self.assertEqual(result.status, "PENDING")
        self.assertEqual(request.full_url, "http://gateway.test/api/v1/messages/send")
        self.assertEqual(headers["x-api-key"], "test-api-key")
        self.assertEqual(payload["recipient"], "6281234567890")
        self.assertEqual(payload["metadata"]["referenceId"], "MR2611240001")
        self.assertEqual(payload["metadata"]["event"], "meeting-approved")
        self.assertEqual(payload["idempotencyKey"], "gass:MR2611240001:meeting-approved")
        self.assertEqual(payload["provider"], "eva")
        self.assertEqual(captured["timeout"], whatsapp_gateway.WHATSAPP_GATEWAY_TIMEOUT_SECONDS)


if __name__ == "__main__":
    unittest.main()
