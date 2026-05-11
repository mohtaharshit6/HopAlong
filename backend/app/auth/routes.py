import os
import jwt
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.users.models import User
from app.auth.middleware import require_auth
from app.sms import send_sms


def _make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return jwt.encode(payload, os.environ.get("SECRET_KEY", "dev"), algorithm="HS256")


auth_bp = Blueprint("auth", __name__)


# ─── Phone OTP ────────────────────────────────────────────────────────────────

@auth_bp.route("/send-otp", methods=["POST"])
def send_otp():
    data = request.get_json() or {}
    phone = data.get("phone", "").strip()
    if not phone or len(phone) < 10:
        return jsonify({"error": "Valid phone number required"}), 400

    user = User.query.filter_by(phone=phone).first()
    if not user:
        user = User(phone=phone)
        db.session.add(user)

    otp = user.generate_otp()
    db.session.commit()

    # Format phone to E.164 — prefix +91 for Indian numbers if no country code given
    e164 = phone if phone.startswith("+") else f"+91{phone}"
    message = f"Your HopAlong OTP is {otp}. Valid for 5 minutes. Do not share it with anyone."
    send_sms(e164, message)

    return jsonify({"message": "OTP sent", "expiresIn": 300})


@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json() or {}
    phone = data.get("phone", "").strip()
    otp = data.get("otp", "").strip()

    if not phone or not otp:
        return jsonify({"error": "phone and otp are required"}), 400

    user = User.query.filter_by(phone=phone).first()
    if not user:
        return jsonify({"error": "Phone number not found"}), 404

    if not user.verify_otp(otp):
        return jsonify({"error": "Invalid or expired OTP"}), 401

    is_new_user = not user.phone_verified
    user.phone_verified = True
    user.otp_code = None
    user.otp_expires_at = None
    db.session.commit()

    token = _make_token(user.id)
    return jsonify({
        "token": token,
        "user": user.to_dict(),
        "isNewUser": is_new_user,
    })


# ─── Profile Completion ───────────────────────────────────────────────────────

@auth_bp.route("/profile", methods=["PUT"])
@require_auth
def update_profile():
    data = request.get_json() or {}
    user = db.session.get(User, g.user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    if "name" in data and data["name"].strip():
        user.name = data["name"].strip()
    if "email" in data and data["email"].strip():
        email = data["email"].strip().lower()
        existing = User.query.filter_by(email=email).first()
        if existing and existing.id != user.id:
            return jsonify({"error": "Email already in use"}), 409
        user.email = email
    if "role" in data and data["role"] in ("rider", "driver", "both"):
        user.role = data["role"]
    if "profile_picture" in data:
        user.profile_picture = data["profile_picture"]

    db.session.commit()
    return jsonify({"user": user.to_dict()})


# ─── Google OAuth ─────────────────────────────────────────────────────────────

@auth_bp.route("/google", methods=["POST"])
def google_auth():
    data = request.get_json() or {}
    # expo-auth-session returns user info directly; accept that
    google_user = data.get("user", {})
    email = (google_user.get("email") or data.get("email", "")).strip().lower()
    name = google_user.get("name") or data.get("name", "")
    picture = google_user.get("photo") or data.get("picture", "")

    if not email:
        return jsonify({"error": "Email is required from Google"}), 400

    user = User.query.filter_by(email=email).first()
    is_new_user = user is None
    if not user:
        user = User(name=name, email=email, profile_picture=picture, phone_verified=False)
        db.session.add(user)
        db.session.commit()
    else:
        if name and not user.name:
            user.name = name
        if picture and not user.profile_picture:
            user.profile_picture = picture
        db.session.commit()

    token = _make_token(user.id)
    return jsonify({
        "token": token,
        "user": user.to_dict(),
        "isNewUser": is_new_user,
    })


# ─── Email / Password (kept as backup) ───────────────────────────────────────

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    phone = data.get("phone", "").strip()

    if not name or not email or not password:
        return jsonify({"error": "name, email, and password are required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(name=name, email=email, phone=phone or None)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = _make_token(user.id)
    return jsonify({"token": token, "user": user.to_dict(), "isNewUser": True}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password"}), 401

    token = _make_token(user.id)
    return jsonify({"token": token, "user": user.to_dict(), "isNewUser": False})


# ─── Current User ─────────────────────────────────────────────────────────────

@auth_bp.route("/me", methods=["GET"])
@require_auth
def get_current_user():
    user = db.session.get(User, g.user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    from app.ratings.models import Rating
    from app.bookings.models import Booking
    from app.rides.models import Ride

    completed_as_rider = (
        db.session.query(Booking)
        .join(Ride, Booking.ride_id == Ride.id)
        .filter(
            Booking.rider_id == g.user_id,
            Ride.status == "completed",
            Booking.status == "confirmed",
        ).all()
    )
    completed_as_driver = (
        db.session.query(Booking)
        .join(Ride, Booking.ride_id == Ride.id)
        .filter(
            Ride.driver_id == g.user_id,
            Ride.status == "completed",
            Booking.status == "confirmed",
        ).all()
    )

    rated_booking_ids = {
        r.booking_id for r in Rating.query.filter_by(rater_id=g.user_id).all()
    }
    pending = [
        b for b in (completed_as_rider + completed_as_driver)
        if b.id not in rated_booking_ids
    ]

    user_data = user.to_dict()
    user_data["pending_rating_count"] = len(pending)
    return jsonify(user_data)
