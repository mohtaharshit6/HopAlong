import random
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.bids.models import Bid
from app.rides.models import Ride
from app.bookings.models import Booking
from app.auth.middleware import require_auth

bids_bp = Blueprint("bids", __name__)


def _auto_expire(bid: Bid):
    if bid.status == "pending" and bid.is_expired:
        bid.status = "expired"
        db.session.commit()


@bids_bp.route("", methods=["POST"])
@require_auth
def create_bid():
    data = request.get_json() or {}
    ride_id = data.get("ride_id")
    offered_fare = data.get("offered_fare")
    seats = int(data.get("seats", 1))
    message = data.get("message", "").strip()[:200]

    if not ride_id or offered_fare is None:
        return jsonify({"error": "ride_id and offered_fare are required"}), 400
    offered_fare = float(offered_fare)
    if offered_fare < 1:
        return jsonify({"error": "Offered fare must be at least 1"}), 400
    if seats < 1:
        return jsonify({"error": "seats must be at least 1"}), 400

    ride = db.session.get(Ride, ride_id)
    if not ride:
        return jsonify({"error": "Ride not found"}), 404
    if ride.driver_id == g.user_id:
        return jsonify({"error": "Cannot bid on your own ride"}), 400
    if ride.status != "scheduled":
        return jsonify({"error": "Ride is not accepting bids"}), 400
    if ride.available_seats < seats:
        return jsonify({"error": f"Only {ride.available_seats} seat(s) available"}), 409

    # Only one active bid per rider per ride
    existing = Bid.query.filter_by(ride_id=ride_id, rider_id=g.user_id).filter(
        Bid.status.in_(["pending", "countered"])
    ).first()
    if existing:
        return jsonify({"error": "You already have an active bid on this ride"}), 409

    bid = Bid(
        ride_id=ride_id,
        rider_id=g.user_id,
        offered_fare=offered_fare,
        seats=seats,
        message=message or None,
    )
    db.session.add(bid)
    db.session.commit()
    return jsonify(bid.to_dict(include_ride=True)), 201


@bids_bp.route("/mine", methods=["GET"])
@require_auth
def my_bids():
    bids = Bid.query.filter_by(rider_id=g.user_id).order_by(Bid.created_at.desc()).all()
    for b in bids:
        _auto_expire(b)
    return jsonify([b.to_dict(include_ride=True) for b in bids])


@bids_bp.route("/ride/<ride_id>", methods=["GET"])
@require_auth
def ride_bids(ride_id):
    ride = db.session.get(Ride, ride_id)
    if not ride:
        return jsonify({"error": "Ride not found"}), 404
    if ride.driver_id != g.user_id:
        return jsonify({"error": "Not authorized"}), 403

    bids = Bid.query.filter_by(ride_id=ride_id).filter(
        Bid.status.in_(["pending", "countered"])
    ).order_by(Bid.created_at.asc()).all()
    for b in bids:
        _auto_expire(b)
    active = [b for b in bids if b.status in ("pending", "countered")]
    return jsonify([b.to_dict(include_rider=True) for b in active])


@bids_bp.route("/<bid_id>/accept", methods=["POST"])
@require_auth
def accept_bid(bid_id):
    bid = db.session.get(Bid, bid_id)
    if not bid:
        return jsonify({"error": "Bid not found"}), 404

    ride = db.session.get(Ride, bid.ride_id)
    if not ride or ride.driver_id != g.user_id:
        return jsonify({"error": "Not authorized"}), 403
    if bid.status not in ("pending",):
        return jsonify({"error": f"Cannot accept a bid with status '{bid.status}'"}), 400
    if bid.is_expired:
        bid.status = "expired"
        db.session.commit()
        return jsonify({"error": "Bid has expired"}), 400
    if ride.available_seats < bid.seats:
        return jsonify({"error": "Not enough seats available"}), 409

    booking = Booking(
        ride_id=bid.ride_id,
        rider_id=bid.rider_id,
        seats_booked=bid.seats,
        status="confirmed",
        payment_status="pending",
        pickup_otp=str(random.randint(1000, 9999)),
        agreed_fare=bid.offered_fare,
    )
    ride.available_seats -= bid.seats
    bid.status = "accepted"
    db.session.add(booking)
    db.session.flush()
    bid.booking_id = booking.id
    db.session.commit()

    return jsonify({"bid": bid.to_dict(), "booking": booking.to_dict(show_otp=True)})


@bids_bp.route("/<bid_id>/reject", methods=["POST"])
@require_auth
def reject_bid(bid_id):
    bid = db.session.get(Bid, bid_id)
    if not bid:
        return jsonify({"error": "Bid not found"}), 404

    ride = db.session.get(Ride, bid.ride_id)
    if not ride or ride.driver_id != g.user_id:
        return jsonify({"error": "Not authorized"}), 403
    if bid.status not in ("pending", "countered"):
        return jsonify({"error": f"Cannot reject a bid with status '{bid.status}'"}), 400

    bid.status = "rejected"
    db.session.commit()
    return jsonify(bid.to_dict())


@bids_bp.route("/<bid_id>/counter", methods=["POST"])
@require_auth
def counter_bid(bid_id):
    data = request.get_json() or {}
    counter_fare = data.get("counter_fare")

    if counter_fare is None:
        return jsonify({"error": "counter_fare is required"}), 400
    counter_fare = float(counter_fare)
    if counter_fare < 1:
        return jsonify({"error": "counter_fare must be at least 1"}), 400

    bid = db.session.get(Bid, bid_id)
    if not bid:
        return jsonify({"error": "Bid not found"}), 404

    ride = db.session.get(Ride, bid.ride_id)
    if not ride or ride.driver_id != g.user_id:
        return jsonify({"error": "Not authorized"}), 403
    if bid.status != "pending":
        return jsonify({"error": f"Cannot counter a bid with status '{bid.status}'"}), 400
    if bid.is_expired:
        bid.status = "expired"
        db.session.commit()
        return jsonify({"error": "Bid has expired"}), 400

    bid.counter_fare = counter_fare
    bid.status = "countered"
    db.session.commit()
    return jsonify(bid.to_dict())


@bids_bp.route("/<bid_id>/accept-counter", methods=["POST"])
@require_auth
def accept_counter(bid_id):
    bid = db.session.get(Bid, bid_id)
    if not bid:
        return jsonify({"error": "Bid not found"}), 404
    if bid.rider_id != g.user_id:
        return jsonify({"error": "Not authorized"}), 403
    if bid.status != "countered":
        return jsonify({"error": f"No counter offer to accept"}), 400

    ride = db.session.get(Ride, bid.ride_id)
    if not ride or ride.available_seats < bid.seats:
        return jsonify({"error": "Not enough seats available"}), 409

    booking = Booking(
        ride_id=bid.ride_id,
        rider_id=bid.rider_id,
        seats_booked=bid.seats,
        status="confirmed",
        payment_status="pending",
        pickup_otp=str(random.randint(1000, 9999)),
        agreed_fare=bid.counter_fare,
    )
    ride.available_seats -= bid.seats
    bid.status = "counter_accepted"
    db.session.add(booking)
    db.session.flush()
    bid.booking_id = booking.id
    db.session.commit()

    return jsonify({"bid": bid.to_dict(), "booking": booking.to_dict(show_otp=True)})


@bids_bp.route("/<bid_id>/reject-counter", methods=["POST"])
@require_auth
def reject_counter(bid_id):
    bid = db.session.get(Bid, bid_id)
    if not bid:
        return jsonify({"error": "Bid not found"}), 404
    if bid.rider_id != g.user_id:
        return jsonify({"error": "Not authorized"}), 403
    if bid.status != "countered":
        return jsonify({"error": "No counter offer to reject"}), 400

    bid.status = "counter_rejected"
    db.session.commit()
    return jsonify(bid.to_dict())
