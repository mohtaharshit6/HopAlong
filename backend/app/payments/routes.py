import os
from flask import Blueprint, request, jsonify, g, Response
from app.extensions import db
from app.bookings.models import Booking
from app.rides.models import Ride
from app.auth.middleware import require_auth
from app.payments import razorpay_client

payments_bp = Blueprint("payments", __name__)


def _get_or_create_order(booking: Booking, ride: Ride):
    """Idempotently create a Razorpay order for the booking."""
    fare = booking.agreed_fare or ride.fare
    amount_paise = int(fare * booking.seats_booked * 100)

    if not booking.razorpay_order_id:
        order = razorpay_client.create_order(amount_paise, receipt=booking.id[:30])
        booking.razorpay_order_id = order["id"]
        db.session.commit()
        return order["id"], amount_paise

    return booking.razorpay_order_id, amount_paise


@payments_bp.route("/create-order", methods=["POST"])
@require_auth
def create_order():
    data = request.get_json() or {}
    booking_id = data.get("booking_id")
    if not booking_id:
        return jsonify({"error": "booking_id is required"}), 400

    booking = db.session.get(Booking, booking_id)
    if not booking or booking.rider_id != g.user_id:
        return jsonify({"error": "Booking not found"}), 404
    if booking.payment_status not in ("pending",):
        return jsonify({"error": "Payment already processed for this booking"}), 400

    ride = db.session.get(Ride, booking.ride_id)
    if not ride:
        return jsonify({"error": "Ride not found"}), 404

    order_id, amount_paise = _get_or_create_order(booking, ride)

    return jsonify({
        "order_id": order_id,
        "amount": amount_paise,
        "currency": "INR",
        "key_id": os.environ.get("RAZORPAY_KEY_ID", ""),
        "booking_id": booking_id,
    })


@payments_bp.route("/checkout/<booking_id>", methods=["GET"])
def checkout_page(booking_id):
    """Browser-based Razorpay checkout page — opened via expo-web-browser."""
    booking = db.session.get(Booking, booking_id)
    if not booking:
        return "<h1>Booking not found</h1>", 404

    ride = db.session.get(Ride, booking.ride_id)
    if not ride:
        return "<h1>Ride not found</h1>", 404

    if booking.payment_status == "held":
        return Response("""<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;
justify-content:center;min-height:100vh;margin:0;background:#f9fafb;}
.box{text-align:center;padding:32px;}h2{color:#10b981;}</style></head>
<body><div class="box"><h2>&#10003; Already Paid</h2>
<p>Your booking is confirmed. Close this tab.</p></div></body></html>""", mimetype="text/html")

    try:
        order_id, amount_paise = _get_or_create_order(booking, ride)
    except Exception as e:
        return f"<h1>Could not create order: {e}</h1>", 500

    key_id = os.environ.get("RAZORPAY_KEY_ID", "")
    fare = booking.agreed_fare or ride.fare
    total = int(fare * booking.seats_booked)

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>HopAlong Payment</title>
  <style>
    *{{box-sizing:border-box;}}
    body{{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
         background:#f9fafb;display:flex;align-items:center;
         justify-content:center;min-height:100vh;margin:0;padding:16px;}}
    .card{{background:#fff;border-radius:20px;padding:28px 24px;
           max-width:380px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.08);
           text-align:center;}}
    .logo{{color:#1e6273;font-size:22px;font-weight:800;margin-bottom:4px;}}
    .route{{color:#6b7280;font-size:14px;margin-bottom:20px;}}
    .amount{{font-size:48px;font-weight:800;color:#111827;margin:8px 0 4px;}}
    .label{{font-size:13px;color:#6b7280;margin-bottom:24px;}}
    button{{width:100%;background:#1e6273;color:#fff;border:none;
            padding:18px;border-radius:14px;font-size:17px;font-weight:700;
            cursor:pointer;transition:opacity .2s;}}
    button:active{{opacity:.85;}}
    button:disabled{{background:#d1d5db;cursor:not-allowed;}}
    .msg{{margin-top:18px;font-size:15px;font-weight:600;min-height:24px;}}
    .success{{color:#10b981;}}.error{{color:#ef4444;}}
  </style>
</head>
<body>
<div class="card">
  <div class="logo">HopAlong</div>
  <div class="route">{ride.start_location} &rarr; {ride.end_location}</div>
  <div class="amount">&#8377;{total}</div>
  <div class="label">{booking.seats_booked} seat{'s' if booking.seats_booked > 1 else ''} &middot; {ride.date}</div>
  <button id="payBtn" onclick="pay()">Pay &#8377;{total}</button>
  <div class="msg" id="msg"></div>
</div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
function pay() {{
  document.getElementById('payBtn').disabled = true;
  var rzp = new Razorpay({{
    key: "{key_id}",
    amount: {amount_paise},
    currency: "INR",
    order_id: "{order_id}",
    name: "HopAlong",
    description: "{ride.start_location} to {ride.end_location}",
    theme: {{color: "#1e6273"}},
    handler: function(resp) {{
      var msg = document.getElementById('msg');
      msg.textContent = 'Verifying payment…';
      fetch('/api/payments/verify-web', {{
        method: 'POST',
        headers: {{'Content-Type': 'application/json'}},
        body: JSON.stringify({{
          payment_id: resp.razorpay_payment_id,
          order_id: resp.razorpay_order_id,
          signature: resp.razorpay_signature,
          booking_id: "{booking_id}"
        }})
      }}).then(function(r) {{
        if (r.ok) {{
          msg.textContent = '✓ Payment successful! Close this tab to continue.';
          msg.className = 'msg success';
          document.getElementById('payBtn').style.display = 'none';
        }} else {{
          r.json().then(function(d) {{
            msg.textContent = 'Error: ' + (d.error || 'Verification failed');
            msg.className = 'msg error';
            document.getElementById('payBtn').disabled = false;
          }});
        }}
      }}).catch(function() {{
        msg.textContent = 'Network error. Please try again.';
        msg.className = 'msg error';
        document.getElementById('payBtn').disabled = false;
      }});
    }},
    modal: {{
      ondismiss: function() {{
        document.getElementById('msg').textContent = 'Payment cancelled.';
        document.getElementById('msg').className = 'msg error';
        document.getElementById('payBtn').disabled = false;
      }}
    }}
  }});
  rzp.open();
}}
</script>
</body>
</html>"""

    return Response(html, mimetype="text/html")


@payments_bp.route("/verify-web", methods=["POST"])
def verify_payment_web():
    """Called from the checkout HTML page — no JWT required; Razorpay HMAC is the proof."""
    data = request.get_json() or {}
    payment_id = data.get("payment_id")
    order_id = data.get("order_id")
    signature = data.get("signature")
    booking_id = data.get("booking_id")

    if not all([payment_id, order_id, signature, booking_id]):
        return jsonify({"error": "Missing required fields"}), 400

    if not razorpay_client.verify_signature(order_id, payment_id, signature):
        return jsonify({"error": "Invalid payment signature"}), 400

    booking = db.session.get(Booking, booking_id)
    if not booking:
        return jsonify({"error": "Booking not found"}), 404

    if booking.payment_status == "held":
        return jsonify({"message": "Already verified"})

    booking.razorpay_payment_id = payment_id
    booking.payment_status = "held"
    db.session.commit()

    return jsonify({"message": "Payment verified", "booking": booking.to_dict()})


@payments_bp.route("/verify", methods=["POST"])
@require_auth
def verify_payment():
    data = request.get_json() or {}
    payment_id = data.get("payment_id")
    order_id = data.get("order_id")
    signature = data.get("signature")
    booking_id = data.get("booking_id")

    if not all([payment_id, order_id, signature, booking_id]):
        return jsonify({"error": "payment_id, order_id, signature, and booking_id are required"}), 400

    if not razorpay_client.verify_signature(order_id, payment_id, signature):
        return jsonify({"error": "Invalid payment signature"}), 400

    booking = db.session.get(Booking, booking_id)
    if not booking or booking.rider_id != g.user_id:
        return jsonify({"error": "Booking not found"}), 404

    booking.razorpay_payment_id = payment_id
    booking.payment_status = "held"
    db.session.commit()

    return jsonify({"message": "Payment verified", "booking": booking.to_dict()})


@payments_bp.route("/status/<booking_id>", methods=["GET"])
@require_auth
def payment_status(booking_id):
    """Polled by mobile after browser closes to check if payment completed."""
    booking = db.session.get(Booking, booking_id)
    if not booking or booking.rider_id != g.user_id:
        return jsonify({"error": "Booking not found"}), 404
    return jsonify({
        "booking_id": booking_id,
        "payment_status": booking.payment_status,
    })
