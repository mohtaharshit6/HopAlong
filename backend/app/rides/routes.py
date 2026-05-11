import math
from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.rides.models import Ride
from app.auth.middleware import require_auth

rides_bp = Blueprint("rides", __name__)


def haversine_km(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@rides_bp.route("", methods=["GET"])
def list_rides():
    query = Ride.query.filter(
        Ride.available_seats > 0,
        Ride.status == "scheduled",
    )

    lat = request.args.get("lat", type=float)
    lng = request.args.get("lng", type=float)
    radius = request.args.get("radius", type=float, default=20.0)
    date_filter = request.args.get("date")

    if date_filter:
        query = query.filter(Ride.date == date_filter)

    rides = query.order_by(Ride.date.asc(), Ride.time.asc()).all()

    if lat is not None and lng is not None:
        rides = [
            r for r in rides
            if r.start_lat and r.start_lng
            and haversine_km(lat, lng, r.start_lat, r.start_lng) <= radius
        ]

    return jsonify([r.to_dict(include_driver=True) for r in rides])


@rides_bp.route("", methods=["POST"])
@require_auth
def create_ride():
    data = request.get_json() or {}

    required = ["start_location", "end_location", "date", "time", "total_seats", "fare"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        return jsonify({"error": f"Missing required fields: {', '.join(missing)}"}), 400

    total_seats = int(data["total_seats"])
    if total_seats < 1:
        return jsonify({"error": "total_seats must be at least 1"}), 400

    fare = float(data["fare"])
    if fare < 0:
        return jsonify({"error": "fare cannot be negative"}), 400

    ride = Ride(
        driver_id=g.user_id,
        start_location=data["start_location"].strip(),
        start_lat=data.get("start_lat"),
        start_lng=data.get("start_lng"),
        end_location=data["end_location"].strip(),
        end_lat=data.get("end_lat"),
        end_lng=data.get("end_lng"),
        date=data["date"],
        time=data["time"],
        total_seats=total_seats,
        available_seats=total_seats,
        fare=fare,
    )
    db.session.add(ride)
    db.session.commit()
    return jsonify(ride.to_dict(include_driver=True)), 201


@rides_bp.route("/my", methods=["GET"])
@require_auth
def my_rides():
    rides = Ride.query.filter_by(driver_id=g.user_id).order_by(Ride.date.desc()).all()
    return jsonify([r.to_dict() for r in rides])


@rides_bp.route("/earnings", methods=["GET"])
@require_auth
def get_earnings():
    from app.bookings.models import Booking
    from datetime import date as date_cls

    completed = Ride.query.filter_by(driver_id=g.user_id, status="completed").all()
    today_str = str(date_cls.today())

    today_total = 0.0
    all_total = 0.0
    for ride in completed:
        confirmed = Booking.query.filter_by(ride_id=ride.id, status="confirmed").all()
        amount = sum(b.seats_booked * ride.fare for b in confirmed)
        all_total += amount
        if ride.date == today_str:
            today_total += amount

    return jsonify({
        "today": round(today_total, 2),
        "total": round(all_total, 2),
        "rides_completed": len(completed),
    })


@rides_bp.route("/<ride_id>", methods=["GET"])
def get_ride(ride_id):
    ride = db.session.get(Ride, ride_id)
    if not ride:
        return jsonify({"error": "Ride not found"}), 404
    return jsonify(ride.to_dict(include_driver=True))


@rides_bp.route("/<ride_id>/bookings", methods=["GET"])
@require_auth
def get_ride_bookings(ride_id):
    from app.bookings.models import Booking
    ride = db.session.get(Ride, ride_id)
    if not ride:
        return jsonify({"error": "Ride not found"}), 404
    if ride.driver_id != g.user_id:
        return jsonify({"error": "Not authorized"}), 403
    bookings = Booking.query.filter_by(ride_id=ride_id, status="confirmed").all()
    return jsonify([b.to_dict(include_rider=True) for b in bookings])


@rides_bp.route("/<ride_id>/start", methods=["POST"])
@require_auth
def start_ride(ride_id):
    ride = db.session.get(Ride, ride_id)
    if not ride:
        return jsonify({"error": "Ride not found"}), 404
    if ride.driver_id != g.user_id:
        return jsonify({"error": "Only the driver can start this ride"}), 403
    if ride.status != "scheduled":
        return jsonify({"error": f"Cannot start a ride with status '{ride.status}'"}), 400

    ride.status = "in_progress"
    db.session.commit()
    return jsonify(ride.to_dict())


@rides_bp.route("/<ride_id>/complete", methods=["POST"])
@require_auth
def complete_ride(ride_id):
    ride = db.session.get(Ride, ride_id)
    if not ride:
        return jsonify({"error": "Ride not found"}), 404
    if ride.driver_id != g.user_id:
        return jsonify({"error": "Only the driver can complete this ride"}), 403
    if ride.status != "in_progress":
        return jsonify({"error": f"Cannot complete a ride with status '{ride.status}'"}), 400

    ride.status = "completed"

    from app.bookings.models import Booking
    from app.payments.razorpay_client import capture_payment
    confirmed_bookings = Booking.query.filter_by(ride_id=ride_id, status="confirmed").all()
    for booking in confirmed_bookings:
        if booking.razorpay_payment_id and booking.payment_status == "held":
            fare_paise = int(ride.fare * booking.seats_booked * 100)
            capture_payment(booking.razorpay_payment_id, fare_paise)
            booking.payment_status = "released"

    db.session.commit()
    return jsonify(ride.to_dict())


@rides_bp.route("/<ride_id>/cancel", methods=["POST"])
@require_auth
def cancel_ride(ride_id):
    ride = db.session.get(Ride, ride_id)
    if not ride:
        return jsonify({"error": "Ride not found"}), 404
    if ride.driver_id != g.user_id:
        return jsonify({"error": "Only the driver can cancel this ride"}), 403
    if ride.status not in ("scheduled", "in_progress"):
        return jsonify({"error": f"Cannot cancel a ride with status '{ride.status}'"}), 400

    ride.status = "cancelled"

    from app.bookings.models import Booking
    from app.payments.razorpay_client import refund_payment
    confirmed_bookings = Booking.query.filter_by(ride_id=ride_id, status="confirmed").all()
    for booking in confirmed_bookings:
        booking.status = "cancelled"
        if booking.razorpay_payment_id and booking.payment_status == "held":
            fare_paise = int(ride.fare * booking.seats_booked * 100)
            refund_payment(booking.razorpay_payment_id, fare_paise)
            booking.payment_status = "refunded"

    ride.available_seats = ride.total_seats
    db.session.commit()
    return jsonify(ride.to_dict())
