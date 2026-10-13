from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from database import db
from routes import (
    apartments_bp,
    auth_bp,
    matches_bp,
    messages_bp,
    requests_bp,
)


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Разрешаем запросы с фронтенда (для учебного проекта — все источники)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Инициализация JWT
    jwt = JWTManager(app)  # noqa: F841

    # Инициализация БД
    db.init_app(app)

    # Регистрация blueprint'ов
    app.register_blueprint(auth_bp)
    app.register_blueprint(apartments_bp)
    app.register_blueprint(requests_bp)
    app.register_blueprint(matches_bp)
    app.register_blueprint(messages_bp)

    # Создание таблиц при первом запуске
    with app.app_context():
        # Импортируем модели, чтобы SQLAlchemy их "увидел"
        from models import Apartment, ExchangeRequest, Message, User  # noqa

        db.create_all()

    @app.route("/")
    def index():
        return jsonify({"message": "API работает", "status": "ok"})

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
