import os


def send_sms(to: str, body: str) -> bool:
    """Send an SMS. Returns True on success, False on failure.

    Falls back to console logging when Twilio credentials are not configured,
    so the dev loop works without a Twilio account.
    """
    sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    from_number = os.environ.get("TWILIO_PHONE_NUMBER", "")

    if not (sid and token and from_number):
        print(f"\n[SMS — no Twilio credentials] To: {to}\n{body}\n", flush=True)
        return True

    try:
        from twilio.rest import Client
        client = Client(sid, token)
        client.messages.create(body=body, from_=from_number, to=to)
        return True
    except Exception as exc:
        print(f"[SMS ERROR] {exc}", flush=True)
        return False
