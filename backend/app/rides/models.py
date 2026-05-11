import uuid
from datetime import datetime, timezone
from app.extensions import db


class Ride(db.Model):
    __tablename__ = "rides"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    driver_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    start_location = db.Column(db.String(255), nullable=False)
    start_lat = db.Column(db.Float)
    start_lng = db.Column(db.Float)
    end_location = db.Column(db.String(255), nullable=False)
    end_lat = db.Column(db.Float)
    end_lng = db.Column(db.Float)
    date = db.Column(db.String(10), nullable=False)
    time = db.Column(db.String(5), nullable=False)
    total_seats = db.Column(db.Integer, nullable=False)
    available_seats = db.Column(db.Integer, nullable=False)
    fare = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="scheduled")
    driver_lat = db.Column(db.Float)
    driver_lng = db.Column(db.Float)
    driver_location_updated_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    bookings = db.relationship("Booking", backref="ride", lazy=True)

    __table_args__ = (
        db.CheckConstraint("available_seats >= 0", name="check_seats_non_negative"),
        db.CheckConstraint("available_seats <= total_seats", name="check_seats_within_total"),
        db.CheckConstraint(
            "status IN ('scheduled', 'in_progress', 'completed', 'cancelled')",
            name="check_valid_status"
        ),
    )

    def to_dict(self, include_driver=False):
        data = {
            "id": self.id,
            "driver_id": self.driver_id,
            "start_location": self.start_location,
            "start_lat": self.start_lat,
            "start_lng": self.start_lng,
            "end_location": self.end_location,
            "end_lat": self.end_lat,
            "end_lng": self.end_lng,
            "date": self.date,
            "time": self.time,
            "total_seats": self.total_seats,
            "available_seats": self.available_seats,
            "fare": self.fare,
            "status": self.status,
            "driver_lat": self.driver_lat,
            "driver_lng": self.driver_lng,
            "driver_location_updated_at": (
                self.driver_location_updated_at.isoformat()
                if self.driver_location_updated_at else None
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_driver and self.driver:
            data["driver"] = self.driver.to_dict(public=True)
            if self.driver.vehicles:
                data["vehicle"] = self.driver.vehicles[0].to_dict()
        return data
