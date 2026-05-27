from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import BetKind, BetStatus, UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    role: UserRole
    is_active: bool
    created_at: datetime


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8)
    role: UserRole = UserRole.user


class UserUpdate(BaseModel):
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8)
    role: UserRole | None = None


class BetLegBase(BaseModel):
    sport: str
    league: str | None = None
    event_name: str
    market: str
    selection: str
    odds: Decimal = Field(gt=0)
    status: BetStatus = BetStatus.pending


class BetLegCreate(BetLegBase):
    pass


class BetLegRead(BetLegBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class BetBase(BaseModel):
    kind: BetKind
    sport: str
    league: str | None = None
    event_name: str
    market: str
    selection: str
    odds: Decimal = Field(gt=0)
    stake: Decimal = Field(gt=0)
    platform: str | None = None
    placed_at: datetime
    status: BetStatus = BetStatus.pending
    payout: Decimal | None = None
    profit: Decimal | None = None
    pre_match_thoughts: str | None = None
    post_match_review: str | None = None
    mistake_category: str | None = None
    confidence: int | None = Field(default=None, ge=1, le=5)
    tag_names: list[str] = Field(default_factory=list)


class BetCreate(BetBase):
    legs: list[BetLegCreate] = Field(default_factory=list)


class BetUpdate(BaseModel):
    sport: str | None = None
    event_name: str | None = None
    market: str | None = None
    odds: Decimal | None = Field(default=None, gt=0)
    stake: Decimal | None = Field(default=None, gt=0)
    placed_at: datetime | None = None
    status: BetStatus | None = None
    payout: Decimal | None = None
    profit: Decimal | None = None
    pre_match_thoughts: str | None = None
    post_match_review: str | None = None
    mistake_category: str | None = None
    confidence: int | None = Field(default=None, ge=1, le=5)
    tag_names: list[str] | None = None


class BetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    kind: BetKind
    sport: str
    league: str | None
    event_name: str
    market: str
    selection: str
    odds: Decimal
    stake: Decimal
    platform: str | None
    placed_at: datetime
    status: BetStatus
    payout: Decimal | None
    profit: Decimal | None
    pre_match_thoughts: str | None
    post_match_review: str | None
    mistake_category: str | None
    confidence: int | None
    legs: list[BetLegRead]
    tag_names: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class StatsBucket(BaseModel):
    key: str
    bets: int
    stake: Decimal
    profit: Decimal
    roi: Decimal


class StatsRead(BaseModel):
    bets: int
    settled_bets: int
    stake: Decimal
    profit: Decimal
    roi: Decimal
    win_rate: Decimal
    by_sport: list[StatsBucket]
    by_platform: list[StatsBucket]
    by_kind: list[StatsBucket]
    by_user: list[StatsBucket] = []
