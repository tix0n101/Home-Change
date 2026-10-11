from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from database import db
from routes import auth_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Разрешаем запросы с фронтенда (для учебного проекта — все источники)
    CORS(app, resources={r"/api/*": {"origins": "*"}})

    # Инициализация БД
    db.init_app(app)

    # Регистрация blueprint'ов
    app.register_blueprint(auth_bp)

    # Создание таблиц при первом запуске
    with app.app_context():
        # Импортируем модели, чтобы SQLAlchemy их "увидел"
        from models import User  # noqa
        db.create_all()

    @app.route("/")
    def index():
        return jsonify({"message": "API работает", "status": "ok"})

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)