from datetime import datetime

from database import db


class ExchangeRequest(db.Model):
    __tablename__ = "requests"

    id = db.Column(db.Integer, primary_key=True)

    # Кто отправил заявку и какой своей квартирой хочет обменяться
    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    apartment_id = db.Column(db.Integer, db.ForeignKey("apartments.id"), nullable=False)

    # Квартира, которую пользователь хочет получить
    target_apartment_id = db.Column(
        db.Integer, db.ForeignKey("apartments.id"), nullable=False
    )

    message = db.Column(db.Text, default="")
    status = db.Column(db.String(20), default="pending")  # pending / accepted / rejected
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    sender = db.relationship("User", foreign_keys=[sender_id], backref="sent_requests")
    apartment = db.relationship("Apartment", foreign_keys=[apartment_id])
    target_apartment = db.relationship("Apartment", foreign_keys=[target_apartment_id])

    def to_dict(self):
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "sender_name": self.sender.name if self.sender else None,
            "apartment_id": self.apartment_id,
            "apartment": self.apartment.to_dict() if self.apartment else None,
            "target_apartment_id": self.target_apartment_id,
            "target_apartment": self.target_apartment.to_dict()
            if self.target_apartment
            else None,
            "message": self.message,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
