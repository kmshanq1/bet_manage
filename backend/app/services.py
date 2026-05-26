from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Bet, BetKind, BetLeg, BetStatus, BetTag, Tag, User, UserRole
from app.schemas import BetCreate, BetRead, StatsBucket, StatsRead


SETTLED_STATUSES = {
    BetStatus.won,
    BetStatus.lost,
    BetStatus.pushed,
    BetStatus.void,
    BetStatus.half_won,
    BetStatus.half_lost,
}


def calculate_profit(status: BetStatus, stake: Decimal, odds: Decimal, payout: Decimal | None) -> tuple[Decimal | None, Decimal | None]:
    if payout is not None:
        return payout, payout - stake
    if status == BetStatus.pending:
        return None, None
    if status == BetStatus.won:
        calculated_payout = stake * odds
    elif status in (BetStatus.pushed, BetStatus.void):
        calculated_payout = stake
    elif status == BetStatus.half_won:
        calculated_payout = stake + (stake * (odds - Decimal("1")) / Decimal("2"))
    elif status == BetStatus.half_lost:
        calculated_payout = stake / Decimal("2")
    else:
        calculated_payout = Decimal("0")
    return calculated_payout, calculated_payout - stake


def normalize_tags(tag_names: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for tag in tag_names:
        name = tag.strip()
        key = name.lower()
        if name and key not in seen:
            seen.add(key)
            normalized.append(name)
    return normalized


def attach_tags(db: Session, bet: Bet, user_id: int, tag_names: list[str]) -> None:
    bet.tags.clear()
    for name in normalize_tags(tag_names):
        tag = db.scalar(select(Tag).where(Tag.user_id == user_id, Tag.name == name))
        if tag is None:
            tag = Tag(user_id=user_id, name=name)
            db.add(tag)
            db.flush()
        bet.tags.append(BetTag(tag=tag))


def create_bet(db: Session, payload: BetCreate, user: User) -> Bet:
    payout, profit = calculate_profit(payload.status, payload.stake, payload.odds, payload.payout)
    bet = Bet(
        user_id=user.id,
        kind=payload.kind,
        sport=payload.sport,
        league=payload.league,
        event_name=payload.event_name,
        market=payload.market,
        selection=payload.selection,
        odds=payload.odds,
        stake=payload.stake,
        platform=payload.platform,
        placed_at=payload.placed_at,
        status=payload.status,
        payout=payout,
        profit=payload.profit if payload.profit is not None else profit,
        pre_match_thoughts=payload.pre_match_thoughts,
        post_match_review=payload.post_match_review,
        mistake_category=payload.mistake_category,
        confidence=payload.confidence,
        legs=[BetLeg(**leg.model_dump()) for leg in payload.legs],
    )
    if payload.kind == BetKind.parlay and not payload.legs:
        raise ValueError("Parlay bets require at least one leg")
    db.add(bet)
    db.flush()
    attach_tags(db, bet, user.id, payload.tag_names)
    db.commit()
    db.refresh(bet)
    return bet


def bet_to_read(bet: Bet) -> BetRead:
    return BetRead(
        id=bet.id,
        user_id=bet.user_id,
        kind=bet.kind,
        sport=bet.sport,
        league=bet.league,
        event_name=bet.event_name,
        market=bet.market,
        selection=bet.selection,
        odds=bet.odds,
        stake=bet.stake,
        platform=bet.platform,
        placed_at=bet.placed_at,
        status=bet.status,
        payout=bet.payout,
        profit=bet.profit,
        pre_match_thoughts=bet.pre_match_thoughts,
        post_match_review=bet.post_match_review,
        mistake_category=bet.mistake_category,
        confidence=bet.confidence,
        legs=list(bet.legs),
        tag_names=[bet_tag.tag.name for bet_tag in bet.tags],
        created_at=bet.created_at,
        updated_at=bet.updated_at,
    )


def scoped_bet_query(current_user: User):
    query = select(Bet).options(selectinload(Bet.legs), selectinload(Bet.tags).selectinload(BetTag.tag))
    if current_user.role != UserRole.admin:
        query = query.where(Bet.user_id == current_user.id)
    return query


def stats_for_query(db: Session, current_user: User, user_id: int | None = None) -> StatsRead:
    query = select(Bet)
    if current_user.role != UserRole.admin:
        query = query.where(Bet.user_id == current_user.id)
    elif user_id is not None:
        query = query.where(Bet.user_id == user_id)
    bets = list(db.scalars(query))
    total_stake = sum((bet.stake for bet in bets), Decimal("0"))
    total_profit = sum((bet.profit or Decimal("0") for bet in bets), Decimal("0"))
    settled = [bet for bet in bets if bet.status in SETTLED_STATUSES]
    won = [bet for bet in settled if bet.profit is not None and bet.profit > 0]

    def bucket(attr: str) -> list[StatsBucket]:
        rows = []
        keys = sorted({_bucket_key(getattr(bet, attr) or "未填写") for bet in bets})
        for key in keys:
            items = [bet for bet in bets if _bucket_key(getattr(bet, attr) or "未填写") == key]
            stake = sum((bet.stake for bet in items), Decimal("0"))
            profit = sum((bet.profit or Decimal("0") for bet in items), Decimal("0"))
            rows.append(StatsBucket(key=key, bets=len(items), stake=stake, profit=profit, roi=roi(profit, stake)))
        return rows

    by_user: list[StatsBucket] = []
    if current_user.role == UserRole.admin:
        rows = db.execute(
            select(User.username, func.count(Bet.id), func.coalesce(func.sum(Bet.stake), 0), func.coalesce(func.sum(Bet.profit), 0))
            .join(Bet, Bet.user_id == User.id, isouter=True)
            .group_by(User.username)
            .order_by(User.username)
        )
        by_user = [
            StatsBucket(key=username, bets=count, stake=stake, profit=profit, roi=roi(Decimal(profit), Decimal(stake)))
            for username, count, stake, profit in rows
        ]

    return StatsRead(
        bets=len(bets),
        settled_bets=len(settled),
        stake=total_stake,
        profit=total_profit,
        roi=roi(total_profit, total_stake),
        win_rate=Decimal(len(won)) / Decimal(len(settled)) if settled else Decimal("0"),
        by_sport=bucket("sport"),
        by_platform=bucket("platform"),
        by_kind=bucket("kind"),
        by_user=by_user,
    )


def roi(profit: Decimal, stake: Decimal) -> Decimal:
    return profit / stake if stake else Decimal("0")


def _bucket_key(value) -> str:
    enum_value = getattr(value, "value", None)
    return str(enum_value if enum_value is not None else value)
