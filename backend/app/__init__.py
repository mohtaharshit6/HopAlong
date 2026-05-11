from flask import Flask, jsonify
from .config import config
from .extensions import db, migrate, cors


def create_app(config_name="default"):
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})

    from .auth.routes import auth_bp
    from .users.routes import users_bp
    from .rides.routes import rides_bp
    from .bookings.routes import bookings_bp
    from .payments.routes import payments_bp
    from .ratings.routes import ratings_bp
    from .bids.routes import bids_bp
    from .kyc.routes import kyc_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(rides_bp, url_prefix="/api/rides")
    app.register_blueprint(bookings_bp, url_prefix="/api/bookings")
    app.register_blueprint(payments_bp, url_prefix="/api/payments")
    app.register_blueprint(ratings_bp, url_prefix="/api/ratings")
    app.register_blueprint(bids_bp, url_prefix="/api/bids")
    app.register_blueprint(kyc_bp, url_prefix="/api/kyc")

    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "app": "HopAlong API", "version": "2.0"})

    return app
