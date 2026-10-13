from datetime import datetime

from database import db


class Apartment(db.Model):
    __tablename__ = "apartments"

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    title = db.Column(db.String(120), nullable=False)
    description = db.Column(db.Text, default="")
    city = db.Column(db.String(80), nullable=False)
    district = db.Column(db.String(80), default="")
    address = db.Column(db.String(200), default="")

    rooms = db.Column(db.Integer, default=1)
    area = db.Column(db.Float, default=0.0)
    floor = db.Column(db.Integer, default=1)
    floors = db.Column(db.Integer, default=1)
    price = db.Column(db.Float, default=0.0)
    image = db.Column(db.String(255), default="")

    status = db.Column(db.String(20), default="active")  # active / closed
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    owner = db.relationship("User", backref="apartments")

    def to_dict(self):
        return {
            "id": self.id,
            "owner_id": self.owner_id,
            "owner_name": self.owner.name if self.owner else None,
            "title": self.title,
            "description": self.description,
            "city": self.city,
            "district": self.district,
            "address": self.address,
            "rooms": self.rooms,
            "area": self.area,
            "floor": self.floor,
            "floors": self.floors,
            "price": self.price,
            "image": self.image,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
