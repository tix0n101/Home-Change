from datetime import datetime

from database import db


class Message(db.Model):
    __tablename__ = "messages"

    id = db.Column(db.Integer, primary_key=True)

    sender_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    # Необязательная привязка к заявке на обмен
    request_id = db.Column(db.Integer, db.ForeignKey("requests.id"), nullable=True)

    text = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    sender = db.relationship("User", foreign_keys=[sender_id])
    receiver = db.relationship("User", foreign_keys=[receiver_id])
    request = db.relationship("ExchangeRequest", foreign_keys=[request_id])

    def to_dict(self):
        return {
            "id": self.id,
            "sender_id": self.sender_id,
            "sender_name": self.sender.name if self.sender else None,
            "receiver_id": self.receiver_id,
            "receiver_name": self.receiver.name if self.receiver else None,
            "request_id": self.request_id,
            "text": self.text,
            "is_read": self.is_read,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
