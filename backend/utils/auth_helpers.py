from functools import wraps

from flask import jsonify
from flask_jwt_extended import (
    create_access_token,
    get_jwt_identity,
    verify_jwt_in_request,
)
from models.user import User
from werkzeug.security import check_password_hash, generate_password_hash


def hash_password(password: str) -> str:
    return generate_password_hash(password)

def check_password(password_hash: str, password: str) -> bool:
    return check_password_hash(password_hash, password)

def generate_token(user_id: int) -> str:
    return create_access_token(identity=str(user_id))

def token_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            user_id = get_jwt_identity()
            user = User.query.get(int(user_id))
            if not user:
                return jsonify({"message": "Пользователь не найден"}), 404
            return fn(current_user=user, *args, **kwargs)
        except Exception as e:
            return jsonify({"message": "Требуется авторизация", "error": str(e)}), 401
    return wrapper