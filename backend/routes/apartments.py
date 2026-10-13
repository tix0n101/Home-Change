from flask import Blueprint, jsonify, request

from database import db
from models.apartment import Apartment
from models.request import ExchangeRequest
from utils.auth_helpers import token_required

apartments_bp = Blueprint("apartments", __name__, url_prefix="/api/apartments")


def _apply_filters(query):
    city = request.args.get("city")
    if city:
        query = query.filter(Apartment.city.ilike(f"%{city}%"))

    rooms = request.args.get("rooms")
    if rooms:
        try:
            query = query.filter(Apartment.rooms == int(rooms))
        except ValueError:
            pass

    min_price = request.args.get("min_price")
    if min_price:
        try:
            query = query.filter(Apartment.price >= float(min_price))
        except ValueError:
            pass

    max_price = request.args.get("max_price")
    if max_price:
        try:
            query = query.filter(Apartment.price <= float(max_price))
        except ValueError:
            pass

    return query


@apartments_bp.route("", methods=["GET"])
def list_apartments():
    query = Apartment.query.filter_by(status="active")
    query = _apply_filters(query)
    apartments = query.order_by(Apartment.created_at.desc()).all()
    return jsonify([apartment.to_dict() for apartment in apartments]), 200


@apartments_bp.route("/my", methods=["GET"])
@token_required
def my_apartments(current_user):
    apartments = (
        Apartment.query.filter_by(owner_id=current_user.id)
        .order_by(Apartment.created_at.desc())
        .all()
    )
    return jsonify([apartment.to_dict() for apartment in apartments]), 200


@apartments_bp.route("/<int:apartment_id>", methods=["GET"])
def get_apartment(apartment_id):
    apartment = Apartment.query.get(apartment_id)
    if not apartment:
        return jsonify({"message": "Квартира не найдена"}), 404
    return jsonify(apartment.to_dict()), 200


@apartments_bp.route("", methods=["POST"])
@token_required
def create_apartment(current_user):
    data = request.get_json() or {}

    if not data.get("title") or not data.get("city"):
        return jsonify({"message": "Укажите заголовок и город"}), 400

    apartment = Apartment(
        owner_id=current_user.id,
        title=data["title"],
        description=data.get("description", ""),
        city=data["city"],
        district=data.get("district", ""),
        address=data.get("address", ""),
        rooms=int(data.get("rooms", 1) or 1),
        area=float(data.get("area", 0) or 0),
        floor=int(data.get("floor", 1) or 1),
        floors=int(data.get("floors", 1) or 1),
        price=float(data.get("price", 0) or 0),
        image=data.get("image", ""),
    )
    db.session.add(apartment)
    db.session.commit()

    return jsonify({"message": "Квартира добавлена", "apartment": apartment.to_dict()}), 201


@apartments_bp.route("/<int:apartment_id>", methods=["PUT"])
@token_required
def update_apartment(current_user, apartment_id):
    apartment = Apartment.query.get(apartment_id)
    if not apartment:
        return jsonify({"message": "Квартира не найдена"}), 404
    if apartment.owner_id != current_user.id:
        return jsonify({"message": "Нет прав на изменение"}), 403

    data = request.get_json() or {}
    apartment.title = data.get("title", apartment.title)
    apartment.description = data.get("description", apartment.description)
    apartment.city = data.get("city", apartment.city)
    apartment.district = data.get("district", apartment.district)
    apartment.address = data.get("address", apartment.address)
    apartment.status = data.get("status", apartment.status)
    apartment.image = data.get("image", apartment.image)

    for field in ("rooms", "floor", "floors"):
        if data.get(field) is not None:
            setattr(apartment, field, int(data[field]))
    for field in ("area", "price"):
        if data.get(field) is not None:
            setattr(apartment, field, float(data[field]))

    db.session.commit()
    return jsonify({"message": "Квартира обновлена", "apartment": apartment.to_dict()}), 200


@apartments_bp.route("/<int:apartment_id>", methods=["DELETE"])
@token_required
def delete_apartment(current_user, apartment_id):
    apartment = Apartment.query.get(apartment_id)
    if not apartment:
        return jsonify({"message": "Квартира не найдена"}), 404
    if apartment.owner_id != current_user.id:
        return jsonify({"message": "Нет прав на удаление"}), 403

    ExchangeRequest.query.filter(
        (ExchangeRequest.apartment_id == apartment_id)
        | (ExchangeRequest.target_apartment_id == apartment_id)
    ).delete(synchronize_session=False)

    db.session.delete(apartment)
    db.session.commit()
    return jsonify({"message": "Квартира удалена"}), 200
