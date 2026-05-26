import os

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import User, UserRole
from app.security import get_password_hash


def main() -> None:
    Base.metadata.create_all(bind=engine)
    username = os.getenv("ADMIN_USERNAME", "admin")
    password = os.getenv("ADMIN_PASSWORD", "admin123456")
    with SessionLocal() as db:
        existing = db.scalar(select(User).where(User.username == username))
        if existing:
            print(f"Admin user already exists: {username}")
            return
        db.add(User(username=username, password_hash=get_password_hash(password), role=UserRole.admin))
        db.commit()
        print(f"Created admin user: {username}")


if __name__ == "__main__":
    main()
