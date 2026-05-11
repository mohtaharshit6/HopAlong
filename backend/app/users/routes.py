from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.users.models import User, Vehicle
from app.auth.middleware import require_auth

users_bp = Blueprint("users", __name__)


@users_bp.route("/me", methods=["GET"])
@require_auth
def get_me():
    user = db.session.get(User, g.user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict())


@users_bp.route("/me", methods=["PUT"])
@require_auth
def update_me():
    user = db.session.get(User, g.user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.get_json() or {}
    if "name" in data:
        user.name = data["name"].strip()
    if "phone" in data:
        user.phone = data["phone"].strip()
    if "upi_vpa" in data:
        user.upi_vpa = data["upi_vpa"].strip() or None
    db.session.commit()
    return jsonify(user.to_dict())


@users_bp.route("/<user_id>", methods=["GET"])
def get_user(user_id):
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    data = user.to_dict(public=True)
    if user.vehicles:
        data["vehicle"] = user.vehicles[0].to_dict()
    return jsonify(data)


@users_bp.route("/me/push-token", methods=["PUT"])
@require_auth
def register_push_token():
    data = request.get_json() or {}
    token = (data.get("push_token") or "").strip()
    if not token:
        return jsonify({"error": "push_token is required"}), 400

    user = db.session.get(User, g.user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    user.push_token = token
    db.session.commit()
    return jsonify({"message": "Push token registered"})


@users_bp.route("/me/vehicles", methods=["POST"])
@require_auth
def add_vehicle():
    data = request.get_json() or {}
    make = data.get("make", "").strip()
    model = data.get("model", "").strip()
    license_plate = data.get("license_plate", "").strip()
    color = data.get("color", "").strip()

    if not make or not model or not license_plate:
        return jsonify({"error": "make, model, and license_plate are required"}), 400

    vehicle = Vehicle(
        user_id=g.user_id,
        make=make,
        model=model,
        license_plate=license_plate,
        color=color,
    )
    db.session.add(vehicle)
    db.session.commit()
    return jsonify(vehicle.to_dict()), 201


@users_bp.route("/me/vehicles", methods=["GET"])
@require_auth
def get_my_vehicles():
    vehicles = Vehicle.query.filter_by(user_id=g.user_id).all()
    return jsonify([v.to_dict() for v in vehicles])
