from flask import Blueprint, jsonify, request
from sqlalchemy import and_, or_

from database import db
from models.message import Message
from models.user import User
from utils.auth_helpers import token_required

messages_bp = Blueprint("messages", __name__, url_prefix="/api/messages")


@messages_bp.route("", methods=["POST"])
@token_required
def send_message(current_user):
    data = request.get_json() or {}

    receiver_id = data.get("receiver_id")
    text = (data.get("text") or "").strip()

    if not receiver_id or not text:
        return jsonify({"message": "Укажите получателя и текст сообщения"}), 400

    receiver = User.query.get(receiver_id)
    if not receiver:
        return jsonify({"message": "Получатель не найден"}), 404
    if receiver.id == current_user.id:
        return jsonify({"message": "Нельзя отправить сообщение самому себе"}), 400

    message = Message(
        sender_id=current_user.id,
        receiver_id=receiver.id,
        request_id=data.get("request_id"),
        text=text,
    )
    db.session.add(message)
    db.session.commit()

    return jsonify({"message": "Сообщение отправлено", "data": message.to_dict()}), 201


@messages_bp.route("/inbox", methods=["GET"])
@token_required
def inbox(current_user):
    messages = (
        Message.query.filter_by(receiver_id=current_user.id)
        .order_by(Message.created_at.desc())
        .all()
    )
    return jsonify([message.to_dict() for message in messages]), 200


@messages_bp.route("/conversation/<int:user_id>", methods=["GET"])
@token_required
def conversation(current_user, user_id):
    messages = (
        Message.query.filter(
            or_(
                and_(
                    Message.sender_id == current_user.id,
                    Message.receiver_id == user_id,
                ),
                and_(
                    Message.sender_id == user_id,
                    Message.receiver_id == current_user.id,
                ),
            )
        )
        .order_by(Message.created_at.asc())
        .all()
    )
    return jsonify([message.to_dict() for message in messages]), 200


@messages_bp.route("/<int:message_id>/read", methods=["PUT"])
@token_required
def mark_read(current_user, message_id):
    message = Message.query.get(message_id)
    if not message:
        return jsonify({"message": "Сообщение не найдено"}), 404
    if message.receiver_id != current_user.id:
        return jsonify({"message": "Нет доступа к сообщению"}), 403

    message.is_read = True
    db.session.commit()
    return jsonify({"message": "Отмечено как прочитанное"}), 200
