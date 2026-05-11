import os
from functools import wraps
from flask import request, jsonify, g
import jwt


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid authorization header"}), 401

        token = auth_header.split(" ", 1)[1]
        jwt_secret = os.environ.get("SECRET_KEY", "dev")

        try:
            payload = jwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            g.user_id = payload.get("sub")
            if not g.user_id:
                return jsonify({"error": "Invalid token payload"}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        return f(*args, **kwargs)
    return decorated
