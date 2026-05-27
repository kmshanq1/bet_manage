from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models import Bet, BetStatus, BetTag, User, UserRole
from app.schemas import BetCreate, BetRead, BetUpdate
from app.services import attach_tags, bet_to_read, calculate_profit, create_bet, scoped_bet_query

router = APIRouter(prefix="/bets", tags=["bets"])


@router.get("", response_model=list[BetRead])
def list_bets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    user_id: int | None = None,
    sport: str | None = None,
    platform: str | None = None,
    status_filter: BetStatus | None = Query(default=None, alias="status"),
    start_at: datetime | None = None,
    end_at: datetime | None = None,
):
    query = scoped_bet_query(current_user)
    if current_user.role == UserRole.admin and user_id is not None:
        query = query.where(Bet.user_id == user_id)
    if sport:
        query = query.where(Bet.sport == sport)
    if platform:
        query = query.where(Bet.platform == platform)
    if status_filter:
        query = query.where(Bet.status == status_filter)
    if start_at:
        query = query.where(Bet.placed_at >= start_at)
    if end_at:
        query = query.where(Bet.placed_at <= end_at)
    bets = db.scalars(query.order_by(Bet.placed_at.desc(), Bet.id.desc())).all()
    return [bet_to_read(bet) for bet in bets]


@router.post("", response_model=BetRead, status_code=status.HTTP_201_CREATED)
def create_bet_endpoint(payload: BetCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        bet = create_bet(db, payload, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return bet_to_read(load_bet(db, bet.id, current_user))


@router.get("/{bet_id}", response_model=BetRead)
def get_bet(bet_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return bet_to_read(load_bet(db, bet_id, current_user))


@router.patch("/{bet_id}", response_model=BetRead)
def update_bet(bet_id: int, payload: BetUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bet = load_bet(db, bet_id, current_user)
    recalculation_fields_changed = False
    for field in ("sport", "event_name", "market", "placed_at"):
        value = getattr(payload, field)
        if value is not None:
            setattr(bet, field, value)
    for field in ("odds", "stake"):
        value = getattr(payload, field)
        if value is not None:
            setattr(bet, field, value)
            recalculation_fields_changed = True
    if payload.status is not None:
        bet.status = payload.status
        recalculation_fields_changed = True
    if payload.payout is not None:
        bet.payout = payload.payout
    if payload.profit is not None:
        bet.profit = payload.profit
    elif recalculation_fields_changed or payload.payout is not None:
        bet.payout, bet.profit = calculate_profit(bet.status, bet.stake, bet.odds, payload.payout)
    for field in ("pre_match_thoughts", "post_match_review", "mistake_category", "confidence"):
        value = getattr(payload, field)
        if value is not None:
            setattr(bet, field, value)
    if payload.tag_names is not None:
        attach_tags(db, bet, bet.user_id, payload.tag_names)
    db.commit()
    return bet_to_read(load_bet(db, bet_id, current_user))


@router.delete("/{bet_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_bet(bet_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    bet = load_bet(db, bet_id, current_user)
    db.delete(bet)
    db.commit()
    return None


def load_bet(db: Session, bet_id: int, current_user: User) -> Bet:
    query = (
        select(Bet)
        .where(Bet.id == bet_id)
        .options(selectinload(Bet.legs), selectinload(Bet.tags).selectinload(BetTag.tag))
    )
    if current_user.role != UserRole.admin:
        query = query.where(Bet.user_id == current_user.id)
    bet = db.scalar(query)
    if bet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bet not found")
    return bet
