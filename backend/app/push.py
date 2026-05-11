import requests

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def send_push(token: str, title: str, body: str, data: dict = None) -> bool:
    """Fire-and-forget Expo push notification. Returns False silently on any failure."""
    if not token or not token.startswith("ExponentPushToken"):
        return False
    try:
        requests.post(
            EXPO_PUSH_URL,
            json={
                "to": token,
                "title": title,
                "body": body,
                "data": data or {},
                "sound": "default",
                "priority": "high",
            },
            timeout=5,
        )
        return True
    except Exception as exc:
        print(f"[PUSH ERROR] {exc}", flush=True)
        return False


def notify_user(user_id: str, title: str, body: str, data: dict = None) -> None:
    """Look up a user's push token and send a notification. Never raises."""
    try:
        from app.extensions import db
        from app.users.models import User
        user = db.session.get(User, user_id)
        if user and user.push_token:
            send_push(user.push_token, title, body, data)
    except Exception as exc:
        print(f"[PUSH LOOKUP ERROR] {exc}", flush=True)
