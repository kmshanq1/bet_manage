import enum
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    admin = "admin"
    user = "user"


class BetKind(str, enum.Enum):
    single = "single"
    parlay = "parlay"


class BetStatus(str, enum.Enum):
    pending = "pending"
    won = "won"
    lost = "lost"
    pushed = "pushed"
    void = "void"
    half_won = "half_won"
    half_lost = "half_lost"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.user)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    bets: Mapped[list["Bet"]] = relationship(back_populates="user")


class Bet(Base):
    __tablename__ = "bets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    kind: Mapped[BetKind] = mapped_column(Enum(BetKind), index=True)
    sport: Mapped[str] = mapped_column(String(64), index=True)
    league: Mapped[str | None] = mapped_column(String(128), nullable=True)
    event_name: Mapped[str] = mapped_column(String(255))
    market: Mapped[str] = mapped_column(String(128))
    selection: Mapped[str] = mapped_column(String(255))
    odds: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    stake: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    platform: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    placed_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    status: Mapped[BetStatus] = mapped_column(Enum(BetStatus), default=BetStatus.pending, index=True)
    payout: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    profit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    pre_match_thoughts: Mapped[str | None] = mapped_column(Text, nullable=True)
    post_match_review: Mapped[str | None] = mapped_column(Text, nullable=True)
    mistake_category: Mapped[str | None] = mapped_column(String(128), nullable=True)
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped[User] = relationship(back_populates="bets")
    legs: Mapped[list["BetLeg"]] = relationship(back_populates="bet", cascade="all, delete-orphan")
    tags: Mapped[list["BetTag"]] = relationship(back_populates="bet", cascade="all, delete-orphan")


class BetLeg(Base):
    __tablename__ = "bet_legs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bet_id: Mapped[int] = mapped_column(ForeignKey("bets.id"), index=True)
    sport: Mapped[str] = mapped_column(String(64))
    league: Mapped[str | None] = mapped_column(String(128), nullable=True)
    event_name: Mapped[str] = mapped_column(String(255))
    market: Mapped[str] = mapped_column(String(128))
    selection: Mapped[str] = mapped_column(String(255))
    odds: Mapped[Decimal] = mapped_column(Numeric(10, 3))
    status: Mapped[BetStatus] = mapped_column(Enum(BetStatus), default=BetStatus.pending)

    bet: Mapped[Bet] = relationship(back_populates="legs")


class Tag(Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_tags_user_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(64))


class BetTag(Base):
    __tablename__ = "bet_tags"
    __table_args__ = (UniqueConstraint("bet_id", "tag_id", name="uq_bet_tags_bet_tag"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bet_id: Mapped[int] = mapped_column(ForeignKey("bets.id"), index=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id"), index=True)

    bet: Mapped[Bet] = relationship(back_populates="tags")
    tag: Mapped[Tag] = relationship()
