from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from app.extensions import db
from app.kyc.models import DriverKYC
from app.auth.middleware import require_auth

kyc_bp = Blueprint("kyc", __name__)


@kyc_bp.route("", methods=["POST"])
@require_auth
def submit_kyc():
    data = request.get_json() or {}
    dl_number = (data.get("dl_number") or "").strip().upper()
    rc_number = (data.get("rc_number") or "").strip().upper()
    dl_photo = data.get("dl_photo")   # base64 data URI, optional
    rc_photo = data.get("rc_photo")   # base64 data URI, optional

    if not dl_number or not rc_number:
        return jsonify({"error": "dl_number and rc_number are required"}), 400

    kyc = DriverKYC.query.filter_by(user_id=g.user_id).first()

    if kyc:
        # Re-submission resets to submitted so admins re-review
        kyc.dl_number = dl_number
        kyc.rc_number = rc_number
        if dl_photo:
            kyc.dl_photo = dl_photo
        if rc_photo:
            kyc.rc_photo = rc_photo
        kyc.status = "submitted"
        kyc.rejection_reason = None
        kyc.submitted_at = datetime.now(timezone.utc)
    else:
        kyc = DriverKYC(
            user_id=g.user_id,
            dl_number=dl_number,
            rc_number=rc_number,
            dl_photo=dl_photo,
            rc_photo=rc_photo,
        )
        db.session.add(kyc)

    db.session.commit()
    return jsonify(kyc.to_dict()), 201


@kyc_bp.route("/me", methods=["GET"])
@require_auth
def get_my_kyc():
    kyc = DriverKYC.query.filter_by(user_id=g.user_id).first()
    if not kyc:
        return jsonify(None)
    return jsonify(kyc.to_dict(include_photos=True))
