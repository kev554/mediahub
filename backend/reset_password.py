from sqlalchemy import select

from app.db.database import SessionLocal
from app.models.user import User
from app.core.security import hash_password


username = "kevin"
new_password = "abcd1234efgh"

db = SessionLocal()

user = db.scalar(
    select(User).where(
        User.username == username
    )
)

if not user:
    print("Utilisateur introuvable")
else:
    user.password_hash = hash_password(new_password)

    db.commit()

    print("Mot de passe modifié pour :", username)

db.close()
