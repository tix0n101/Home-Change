from flask import Blueprint, request, jsonify
from database import db
from models.user import User
from utils.auth_helpers import hash_password, check_password, generate_token

auth_bp = Blueprint("auth", __name__, url_prefix="/api")

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json()

    # Простая валидация
    if not data or not data.get("name") or not data.get("email") or not data.get("password"):
        return jsonify({"message": "Заполните все поля"}), 400

    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"message": "Email уже занят"}), 409

    user = User(
        name=data["name"],
        email=data["email"],
        password_hash=hash_password(data["password"]),
        role=data.get("role", "tenant"),
    )
    db.session.add(user)
    db.session.commit()

    token = generate_token(user.id)
    return jsonify({"message": "Регистрация успешна", "token": token, "user": user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"message": "Введите email и пароль"}), 400

    user = User.query.filter_by(email=data["email"]).first()
    if not user or not check_password(user.password_hash, data["password"]):
        return jsonify({"message": "Неверный email или пароль"}), 401

    token = generate_token(user.id)
    return jsonify({"message": "Вход выполнен", "token": token, "user": user.to_dict()}), 200