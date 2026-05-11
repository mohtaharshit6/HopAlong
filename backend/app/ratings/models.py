import uuid
from datetime import datetime, timezone
from app.extensions import db


class Rating(db.Model):
    __tablename__ = "ratings"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    booking_id = db.Column(db.String(36), db.ForeignKey("bookings.id"), nullable=False)
    rater_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    rated_user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    score = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint("booking_id", "rater_id", name="uq_rating_booking_rater"),
        db.CheckConstraint("score >= 1 AND score <= 5", name="check_score_range"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "booking_id": self.booking_id,
            "rater_id": self.rater_id,
            "rated_user_id": self.rated_user_id,
            "score": self.score,
            "comment": self.comment,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
