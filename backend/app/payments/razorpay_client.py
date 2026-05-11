import os
import hmac
import hashlib


def get_client():
    try:
        import razorpay
    except Exception as e:
        raise RuntimeError(f"Razorpay unavailable: {e}")
    return razorpay.Client(auth=(
        os.environ.get("RAZORPAY_KEY_ID"),
        os.environ.get("RAZORPAY_KEY_SECRET"),
    ))


def create_order(amount_paise: int, receipt: str) -> dict:
    return get_client().order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "payment_capture": 0,  # manual capture on ride completion
    })


def verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    secret = os.environ.get("RAZORPAY_KEY_SECRET", "").encode()
    message = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(secret, message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def capture_payment(payment_id: str, amount_paise: int) -> dict:
    try:
        return get_client().payment.capture(payment_id, amount_paise, {"currency": "INR"})
    except Exception:
        return {}


def refund_payment(payment_id: str, amount_paise: int) -> dict:
    try:
        return get_client().payment.refund(payment_id, {"amount": amount_paise})
    except Exception:
        return {}
