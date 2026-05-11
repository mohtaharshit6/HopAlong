import uuid
from datetime import datetime, timezone, timedelta
from app.extensions import db


class Bid(db.Model):
    __tablename__ = "bids"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ride_id = db.Column(db.String(36), db.ForeignKey("rides.id"), nullable=False)
    rider_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    offered_fare = db.Column(db.Float, nullable=False)   # rider's initial offer
    counter_fare = db.Column(db.Float)                    # driver's counter offer
    seats = db.Column(db.Integer, nullable=False, default=1)
    message = db.Column(db.String(200))
    status = db.Column(db.String(20), nullable=False, default="pending")
    booking_id = db.Column(db.String(36))                 # set when bid is accepted
    expires_at = db.Column(db.DateTime, nullable=False,
                           default=lambda: datetime.now(timezone.utc) + timedelta(hours=2))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    ride = db.relationship("Ride", foreign_keys=[ride_id], lazy="joined")
    rider = db.relationship("User", foreign_keys=[rider_id], lazy="joined")

    __table_args__ = (
        db.CheckConstraint(
            "status IN ('pending','accepted','rejected','countered','counter_accepted','counter_rejected','expired')",
            name="check_bid_status",
        ),
    )

    @property
    def is_expired(self):
        return datetime.now(timezone.utc) > self.expires_at.replace(tzinfo=timezone.utc)

    @property
    def agreed_fare(self):
        if self.status == "counter_accepted":
            return self.counter_fare
        return self.offered_fare

    def to_dict(self, include_rider=False, include_ride=False):
        data = {
            "id": self.id,
            "ride_id": self.ride_id,
            "rider_id": self.rider_id,
            "offered_fare": self.offered_fare,
            "counter_fare": self.counter_fare,
            "seats": self.seats,
            "message": self.message,
            "status": self.status,
            "booking_id": self.booking_id,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_rider and self.rider:
            data["rider"] = self.rider.to_dict(public=True)
        if include_ride and self.ride:
            data["ride"] = self.ride.to_dict(include_driver=True)
        return data
