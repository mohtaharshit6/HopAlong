import uuid
from datetime import datetime, timezone
from app.extensions import db


class Booking(db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ride_id = db.Column(db.String(36), db.ForeignKey("rides.id"), nullable=False)
    rider_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    seats_booked = db.Column(db.Integer, nullable=False, default=1)
    status = db.Column(db.String(20), nullable=False, default="confirmed")
    payment_status = db.Column(db.String(20), nullable=False, default="pending")
    razorpay_order_id = db.Column(db.String(100))
    razorpay_payment_id = db.Column(db.String(100))
    pickup_otp = db.Column(db.String(4))
    pickup_verified = db.Column(db.Boolean, default=False)
    agreed_fare = db.Column(db.Float)   # set when booking comes from an accepted bid
    cancel_reason = db.Column(db.String(100))
    payment_method = db.Column(db.String(10), nullable=False, default="online")  # online | upi | cash
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        db.UniqueConstraint("ride_id", "rider_id", name="uq_booking_ride_rider"),
        db.CheckConstraint(
            "status IN ('confirmed', 'cancelled')",
            name="check_booking_status"
        ),
        db.CheckConstraint(
            "payment_status IN ('pending', 'held', 'released', 'refunded', 'failed',"
            " 'upi_pending', 'upi_received', 'cash_pending', 'cash_collected')",
            name="check_payment_status"
        ),
        db.CheckConstraint(
            "payment_method IN ('online', 'upi', 'cash')",
            name="check_payment_method"
        ),
    )

    def to_dict(self, include_ride=False, include_rider=False, show_otp=False):
        data = {
            "id": self.id,
            "ride_id": self.ride_id,
            "rider_id": self.rider_id,
            "seats_booked": self.seats_booked,
            "status": self.status,
            "payment_status": self.payment_status,
            "pickup_verified": self.pickup_verified or False,
            "agreed_fare": self.agreed_fare,
            "cancel_reason": self.cancel_reason,
            "payment_method": self.payment_method,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if show_otp:
            data["pickup_otp"] = self.pickup_otp
        if include_ride and self.ride:
            data["ride"] = self.ride.to_dict(include_driver=True)
        if include_rider and self.rider:
            data["rider"] = self.rider.to_dict(public=True)
        return data
