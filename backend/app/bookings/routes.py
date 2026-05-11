import random
from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.bookings.models import Booking
from app.rides.models import Ride
from app.auth.middleware import require_auth

bookings_bp = Blueprint("bookings", __name__)


@bookings_bp.route("", methods=["POST"])
@require_auth
def create_booking():
    data = request.get_json() or {}
    ride_id = data.get("ride_id")
    seats = int(data.get("seats", 1))

    if not ride_id:
        return jsonify({"error": "ride_id is required"}), 400
    if seats < 1:
        return jsonify({"error": "seats must be at least 1"}), 400

    ride = db.session.query(Ride).filter_by(id=ride_id).with_for_update().first()
    if not ride:
        return jsonify({"error": "Ride not found"}), 404
    if ride.driver_id == g.user_id:
        return jsonify({"error": "You cannot book your own ride"}), 400
    if ride.status != "scheduled":
        return jsonify({"error": "This ride is no longer accepting bookings"}), 400
    if ride.available_seats < seats:
        return jsonify({"error": f"Only {ride.available_seats} seat(s) available"}), 409

    existing = Booking.query.filter_by(ride_id=ride_id, rider_id=g.user_id).first()
    if existing and existing.status == "confirmed":
        return jsonify({"error": "You have already booked this ride"}), 409

    method = data.get("payment_method", "online")
    if method not in ("online", "upi", "cash"):
        method = "online"

    initial_status = {
        "online": "pending",
        "upi": "upi_pending",
        "cash": "cash_pending",
    }[method]

    pickup_otp = str(random.randint(1000, 9999))
    booking = Booking(
        ride_id=ride_id,
        rider_id=g.user_id,
        seats_booked=seats,
        status="confirmed",
        payment_status=initial_status,
        payment_method=method,
        pickup_otp=pickup_otp,
    )
    ride.available_seats -= seats
    db.session.add(booking)
    db.session.commit()

    return jsonify(booking.to_dict(include_ride=True, show_otp=True)), 201


@bookings_bp.route("/my", methods=["GET"])
@require_auth
def my_bookings():
    bookings = (
        Booking.query
        .filter_by(rider_id=g.user_id)
        .order_by(Booking.created_at.desc())
        .all()
    )
    result = []
    for b in bookings:
        d = b.to_dict(show_otp=True)  # rider sees their own OTP to show driver
        if b.ride:
            d["ride"] = b.ride.to_dict(include_driver=True)
        result.append(d)
    return jsonify(result)


@bookings_bp.route("/<booking_id>/verify-pickup", methods=["POST"])
@require_auth
def verify_pickup(booking_id):
    data = request.get_json() or {}
    otp = str(data.get("otp", "")).strip()

    booking = db.session.get(Booking, booking_id)
    if not booking:
        return jsonify({"error": "Booking not found"}), 404

    ride = db.session.get(Ride, booking.ride_id)
    if not ride or ride.driver_id != g.user_id:
        return jsonify({"error": "Only the ride driver can verify pickup"}), 403
    if ride.status != "in_progress":
        return jsonify({"error": "Ride is not in progress"}), 400
    if booking.pickup_verified:
        return jsonify({"message": "Already verified", "booking": booking.to_dict()}), 200
    if booking.pickup_otp != otp:
        return jsonify({"error": "Invalid OTP"}), 400

    booking.pickup_verified = True
    db.session.commit()
    return jsonify({"message": "Pickup verified", "booking": booking.to_dict()})


@bookings_bp.route("/<booking_id>/confirm-payment", methods=["POST"])
@require_auth
def confirm_manual_payment(booking_id):
    """Driver confirms they received cash or UPI from the rider."""
    booking = db.session.get(Booking, booking_id)
    if not booking:
        return jsonify({"error": "Booking not found"}), 404

    ride = db.session.get(Ride, booking.ride_id)
    if not ride or ride.driver_id != g.user_id:
        return jsonify({"error": "Only the ride driver can confirm payment"}), 403

    if booking.payment_method == "cash" and booking.payment_status == "cash_pending":
        booking.payment_status = "cash_collected"
    elif booking.payment_method == "upi" and booking.payment_status == "upi_pending":
        booking.payment_status = "upi_received"
    else:
        return jsonify({"error": "Nothing to confirm for this booking"}), 400

    db.session.commit()

    from app.push import notify_user
    notify_user(
        booking.rider_id,
        "Payment Confirmed",
        "Your driver confirmed your payment. Enjoy the ride!",
        {"screen": "/(tabs)/my-rides"},
    )
    return jsonify({"message": "Payment confirmed", "booking": booking.to_dict()})


@bookings_bp.route("/<booking_id>", methods=["DELETE"])
@require_auth
def cancel_booking(booking_id):
    data = request.get_json(silent=True) or {}
    reason = (data.get("reason") or "").strip()[:100] or None

    booking = db.session.get(Booking, booking_id)
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    if booking.rider_id != g.user_id:
        return jsonify({"error": "Not your booking"}), 403
    if booking.status == "cancelled":
        return jsonify({"error": "Booking is already cancelled"}), 400

    ride = db.session.query(Ride).filter_by(id=booking.ride_id).with_for_update().first()
    if ride and ride.status == "scheduled":
        ride.available_seats += booking.seats_booked

    booking.status = "cancelled"
    booking.cancel_reason = reason

    if booking.razorpay_payment_id and booking.payment_status == "held":
        from app.payments.razorpay_client import refund_payment
        fare_paise = int(ride.fare * booking.seats_booked * 100) if ride else 0
        if fare_paise > 0:
            refund_payment(booking.razorpay_payment_id, fare_paise)
        booking.payment_status = "refunded"

    db.session.commit()
    return jsonify({"message": "Booking cancelled", "booking": booking.to_dict()})
