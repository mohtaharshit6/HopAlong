from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.ratings.models import Rating
from app.bookings.models import Booking
from app.rides.models import Ride
from app.users.models import User
from app.auth.middleware import require_auth

ratings_bp = Blueprint("ratings", __name__)


@ratings_bp.route("", methods=["POST"])
@require_auth
def submit_rating():
    data = request.get_json() or {}
    booking_id = data.get("booking_id")
    rated_user_id = data.get("rated_user_id")
    score = data.get("score")
    comment = data.get("comment", "")

    if not booking_id or not rated_user_id or score is None:
        return jsonify({"error": "booking_id, rated_user_id, and score are required"}), 400

    score = int(score)
    if score < 1 or score > 5:
        return jsonify({"error": "score must be between 1 and 5"}), 400

    booking = db.session.get(Booking, booking_id)
    if not booking:
        return jsonify({"error": "Booking not found"}), 404

    ride = db.session.get(Ride, booking.ride_id)
    if not ride or ride.status != "completed":
        return jsonify({"error": "Can only rate after ride is completed"}), 400

    # Rater must be either the rider or the driver of this ride
    if g.user_id not in (booking.rider_id, ride.driver_id):
        return jsonify({"error": "Not authorized to rate this ride"}), 403

    # Rated user must be the other party
    if rated_user_id not in (booking.rider_id, ride.driver_id):
        return jsonify({"error": "Invalid rated_user_id for this booking"}), 400
    if rated_user_id == g.user_id:
        return jsonify({"error": "Cannot rate yourself"}), 400

    existing = Rating.query.filter_by(booking_id=booking_id, rater_id=g.user_id).first()
    if existing:
        return jsonify({"error": "You have already rated this ride"}), 409

    rating = Rating(
        booking_id=booking_id,
        rater_id=g.user_id,
        rated_user_id=rated_user_id,
        score=score,
        comment=comment,
    )
    db.session.add(rating)

    rated_user = db.session.get(User, rated_user_id)
    if rated_user:
        rated_user.update_rating(score)

    db.session.commit()
    return jsonify(rating.to_dict()), 201


@ratings_bp.route("/pending", methods=["GET"])
@require_auth
def pending_ratings():
    completed_as_rider = (
        db.session.query(Booking)
        .join(Ride, Booking.ride_id == Ride.id)
        .filter(
            Booking.rider_id == g.user_id,
            Ride.status == "completed",
            Booking.status == "confirmed",
        )
        .all()
    )
    completed_as_driver = (
        db.session.query(Booking)
        .join(Ride, Booking.ride_id == Ride.id)
        .filter(
            Ride.driver_id == g.user_id,
            Ride.status == "completed",
            Booking.status == "confirmed",
        )
        .all()
    )

    rated_booking_ids = {
        r.booking_id
        for r in Rating.query.filter_by(rater_id=g.user_id).all()
    }

    pending = []
    for b in completed_as_rider:
        if b.id not in rated_booking_ids:
            d = b.to_dict(include_ride=True)
            d["context"] = "rate_driver"   # rider rates the driver
            pending.append(d)

    for b in completed_as_driver:
        if b.id not in rated_booking_ids:
            d = b.to_dict(include_ride=True, include_rider=True)
            d["context"] = "rate_rider"    # driver rates the rider
            pending.append(d)

    return jsonify(pending)
