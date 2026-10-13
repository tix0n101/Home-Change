from flask import Blueprint, jsonify, request

from database import db
from models.apartment import Apartment
from models.request import ExchangeRequest
from utils.auth_helpers import token_required

requests_bp = Blueprint("requests", __name__, url_prefix="/api/requests")


@requests_bp.route("", methods=["POST"])
@token_required
def create_request(current_user):
    data = request.get_json() or {}

    apartment_id = data.get("apartment_id")
    target_apartment_id = data.get("target_apartment_id")

    if not apartment_id or not target_apartment_id:
        return jsonify({"message": "Укажите свою и желаемую квартиру"}), 400

    apartment = Apartment.query.get(apartment_id)
    target = Apartment.query.get(target_apartment_id)

    if not apartment or not target:
        return jsonify({"message": "Квартира не найдена"}), 404
    if apartment.owner_id != current_user.id:
        return jsonify({"message": "Можно предлагать только свою квартиру"}), 403
    if apartment.id == target.id:
        return jsonify({"message": "Нельзя обменять квартиру на саму себя"}), 400

    existing = ExchangeRequest.query.filter_by(
        sender_id=current_user.id,
        apartment_id=apartment.id,
        target_apartment_id=target.id,
        status="pending",
    ).first()
    if existing:
        return jsonify({"message": "Заявка уже отправлена"}), 409

    exchange_request = ExchangeRequest(
        sender_id=current_user.id,
        apartment_id=apartment.id,
        target_apartment_id=target.id,
        message=data.get("message", ""),
    )
    db.session.add(exchange_request)
    db.session.commit()

    return (
        jsonify(
            {
                "message": "Заявка отправлена",
                "request": exchange_request.to_dict(),
            }
        ),
        201,
    )


@requests_bp.route("", methods=["GET"])
@token_required
def incoming_requests(current_user):
    requests = (
        ExchangeRequest.query.join(
            Apartment, ExchangeRequest.target_apartment_id == Apartment.id
        )
        .filter(Apartment.owner_id == current_user.id)
        .order_by(ExchangeRequest.created_at.desc())
        .all()
    )
    return jsonify([exchange_request.to_dict() for exchange_request in requests]), 200


@requests_bp.route("/sent", methods=["GET"])
@token_required
def sent_requests(current_user):
    requests = (
        ExchangeRequest.query.filter_by(sender_id=current_user.id)
        .order_by(ExchangeRequest.created_at.desc())
        .all()
    )
    return jsonify([exchange_request.to_dict() for exchange_request in requests]), 200


@requests_bp.route("/<int:request_id>", methods=["GET"])
@token_required
def get_request(current_user, request_id):
    exchange_request = ExchangeRequest.query.get(request_id)
    if not exchange_request:
        return jsonify({"message": "Заявка не найдена"}), 404

    owner_id = (
        exchange_request.target_apartment.owner_id
        if exchange_request.target_apartment
        else None
    )
    if current_user.id not in (exchange_request.sender_id, owner_id):
        return jsonify({"message": "Нет доступа к заявке"}), 403

    return jsonify(exchange_request.to_dict()), 200


@requests_bp.route("/<int:request_id>/status", methods=["PUT"])
@token_required
def update_status(current_user, request_id):
    exchange_request = ExchangeRequest.query.get(request_id)
    if not exchange_request:
        return jsonify({"message": "Заявка не найдена"}), 404

    target = exchange_request.target_apartment
    if not target or target.owner_id != current_user.id:
        return jsonify({"message": "Отвечать на заявку может только владелец квартиры"}), 403

    status = (request.get_json() or {}).get("status")
    if status not in ("accepted", "rejected"):
        return jsonify({"message": "Статус должен быть accepted или rejected"}), 400

    exchange_request.status = status
    db.session.commit()
    return jsonify({"message": "Статус обновлён", "request": exchange_request.to_dict()}), 200


@requests_bp.route("/<int:request_id>", methods=["DELETE"])
@token_required
def cancel_request(current_user, request_id):
    exchange_request = ExchangeRequest.query.get(request_id)
    if not exchange_request:
        return jsonify({"message": "Заявка не найдена"}), 404
    if exchange_request.sender_id != current_user.id:
        return jsonify({"message": "Удалить заявку может только её автор"}), 403

    db.session.delete(exchange_request)
    db.session.commit()
    return jsonify({"message": "Заявка удалена"}), 200
