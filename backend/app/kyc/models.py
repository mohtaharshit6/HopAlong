import uuid
from datetime import datetime, timezone
from app.extensions import db


class DriverKYC(db.Model):
    __tablename__ = "driver_kyc"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False, unique=True)
    dl_number = db.Column(db.String(50), nullable=False)
    rc_number = db.Column(db.String(50), nullable=False)
    dl_photo = db.Column(db.Text)
    rc_photo = db.Column(db.Text)
    status = db.Column(db.String(20), nullable=False, default="submitted")
    rejection_reason = db.Column(db.String(200))
    submitted_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.CheckConstraint(
            "status IN ('submitted', 'verified', 'rejected')",
            name="check_kyc_status"
        ),
    )

    def to_dict(self, include_photos=False):
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "dl_number": self.dl_number,
            "rc_number": self.rc_number,
            "status": self.status,
            "rejection_reason": self.rejection_reason,
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_photos:
            data["dl_photo"] = self.dl_photo
            data["rc_photo"] = self.rc_photo
        return data
