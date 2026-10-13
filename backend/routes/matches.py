from flask import Blueprint, jsonify, request

from models.apartment import Apartment
from utils.auth_helpers import token_required
from utils.matching import find_matches

matches_bp = Blueprint("matches", __name__, url_prefix="/api/matches")


def _collect_unit_matches(apartment):
    candidates = Apartment.query.filter(
        Apartment.status == "active",
        Apartment.id != apartment.id,
        Apartment.owner_id != apartment.owner_id,
    ).all()

    matches = find_matches(apartment, candidates)
    return [
        {"apartment": candidate.to_dict(), "score": score}
        for candidate, score in matches
    ]


@matches_bp.route("", methods=["GET"])
@token_required
def get_matches(current_user):
    apartment_id = request.args.get("apartment_id")

    if apartment_id:
        try:
            apartment_id = int(apartment_id)
        except ValueError:
            return jsonify({"message": "Некорректный apartment_id"}), 400

        apartment = Apartment.query.get(apartment_id)
        if not apartment:
            return jsonify({"message": "Квартира не найдена"}), 404
        if apartment.owner_id != current_user.id:
            return jsonify({"message": "Можно искать пару только для своей квартиры"}), 403

        return (
            jsonify(
                {
                    "apartment_id": apartment.id,
                    "matches": _collect_unit_matches(apartment),
                }
            ),
            200,
        )

    # Без apartment_id — собираем совпадения по всем квартирам пользователя
    my_apartments = Apartment.query.filter_by(owner_id=current_user.id).all()
    if not my_apartments:
        return jsonify({"message": "Сначала добавьте квартиру"}), 400

    result = []
    for apartment in my_apartments:
        result.append(
            {
                "apartment_id": apartment.id,
                "apartment_title": apartment.title,
                "matches": _collect_unit_matches(apartment),
            }
        )

    return jsonify(result), 200
