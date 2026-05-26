from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import StatsRead
from app.services import stats_for_query

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsRead)
def stats(user_id: int | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return stats_for_query(db, current_user, user_id)
