import uuid
import random
from datetime import datetime, timezone, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=True)
    email = db.Column(db.String(255), unique=True, nullable=True)
    password_hash = db.Column(db.String(255))
    phone = db.Column(db.String(20), unique=True, nullable=True)
    phone_verified = db.Column(db.Boolean, default=False)
    otp_code = db.Column(db.String(6))
    otp_expires_at = db.Column(db.DateTime)
    role = db.Column(db.String(20), default="rider")  # rider / driver / both
    rating = db.Column(db.Float, default=0.0)
    total_ratings = db.Column(db.Integer, default=0)
    is_verified = db.Column(db.Boolean, default=False)
    profile_picture = db.Column(db.Text)
    push_token = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    rides_offered = db.relationship("Ride", backref="driver", lazy=True, foreign_keys="Ride.driver_id")
    bookings = db.relationship("Booking", backref="rider", lazy=True, foreign_keys="Booking.rider_id")
    vehicles = db.relationship("Vehicle", backref="owner", lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def generate_otp(self) -> str:
        otp = str(random.randint(100000, 999999))
        self.otp_code = otp
        self.otp_expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
        return otp

    def verify_otp(self, otp: str) -> bool:
        if not self.otp_code or not self.otp_expires_at:
            return False
        if datetime.now(timezone.utc) > self.otp_expires_at.replace(tzinfo=timezone.utc):
            return False
        return self.otp_code == otp

    def update_rating(self, new_score):
        self.rating = (self.rating * self.total_ratings + new_score) / (self.total_ratings + 1)
        self.total_ratings += 1

    def to_dict(self, public=False):
        data = {
            "id": self.id,
            "name": self.name,
            "rating": round(self.rating, 1),
            "total_ratings": self.total_ratings,
            "is_verified": self.is_verified,
            "profile_picture": self.profile_picture,
            "role": self.role,
        }
        if not public:
            data.update({
                "email": self.email,
                "phone": self.phone,
                "phone_verified": self.phone_verified,
                "created_at": self.created_at.isoformat() if self.created_at else None,
            })
        return data


class Vehicle(db.Model):
    __tablename__ = "vehicles"

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey("users.id"), nullable=False)
    make = db.Column(db.String(50), nullable=False)
    model = db.Column(db.String(50), nullable=False)
    license_plate = db.Column(db.String(20), nullable=False)
    color = db.Column(db.String(30))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "make": self.make,
            "model": self.model,
            "license_plate": self.license_plate,
            "color": self.color,
        }
