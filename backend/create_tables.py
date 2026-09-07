from app.db.database import Base, engine

# Important :
# l'import force SQLAlchemy à connaître tous les modèles.
from app.models import User, Media, Album, Group


print("Création des tables MediaHub...")

Base.metadata.create_all(bind=engine)

print("Tables créées avec succès !")
