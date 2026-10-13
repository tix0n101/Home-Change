from routes.auth import auth_bp
from routes.apartments import apartments_bp
from routes.requests import requests_bp
from routes.matches import matches_bp
from routes.messages import messages_bp

__all__ = [
    "auth_bp",
    "apartments_bp",
    "requests_bp",
    "matches_bp",
    "messages_bp",
]
