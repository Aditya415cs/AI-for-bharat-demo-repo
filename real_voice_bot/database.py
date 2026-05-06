"""
database.py — SQLAlchemy setup for AI SkillFit interview results.
Uses SQLite (skillfit.db) for lightweight hackathon-grade persistence.
"""

import os
import logging
from datetime import datetime, timezone

from sqlalchemy import create_engine, Column, Integer, String, Float, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger("skillfit.database")

# ── Database setup ──────────────────────────────────────────────────────────
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "skillfit.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, echo=False, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


# ── Model ───────────────────────────────────────────────────────────────────
class CandidateResult(Base):
    __tablename__ = "candidate_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_name = Column(String(255), nullable=False)
    phone_number = Column(String(20), nullable=False)
    trade = Column(String(255), nullable=False)
    scores = Column(Text, nullable=False)          # JSON string of score list
    weak_topics = Column(Text, nullable=False)     # JSON string of topic list
    fitment = Column(String(50), nullable=False)   # "Job-Ready" / "Requires Training" / etc.
    average_score = Column(Float, nullable=False)
    interview_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        import json
        return {
            "id": self.id,
            "candidate_name": self.candidate_name,
            "phone_number": self.phone_number,
            "trade": self.trade,
            "scores": json.loads(self.scores),
            "weak_topics": json.loads(self.weak_topics),
            "fitment": self.fitment,
            "average_score": self.average_score,
            "interview_date": self.interview_date.isoformat() if self.interview_date else None,
        }


# ── Create tables ───────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)


# ── Helper functions ────────────────────────────────────────────────────────
def save_result(
    candidate_name: str,
    phone_number: str,
    trade: str,
    scores: list,
    weak_topics: list,
    fitment: str,
    average_score: float,
) -> int:
    """
    Saves interview results to SQLite.
    Returns the auto-generated record ID.
    """
    import json

    db = SessionLocal()
    try:
        record = CandidateResult(
            candidate_name=candidate_name,
            phone_number=phone_number,
            trade=trade,
            scores=json.dumps(scores),
            weak_topics=json.dumps(weak_topics),
            fitment=fitment,
            average_score=average_score,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        logger.info(f"[DB] Saved result for {candidate_name} (ID={record.id})")
        return record.id
    except Exception as e:
        db.rollback()
        logger.error(f"[DB] Failed to save result: {e}")
        raise
    finally:
        db.close()


def get_results(trade: str | None = None) -> list[dict]:
    """
    Fetches all interview results, optionally filtered by trade.
    Returns newest-first.
    """
    db = SessionLocal()
    try:
        query = db.query(CandidateResult).order_by(CandidateResult.interview_date.desc())
        if trade:
            query = query.filter(CandidateResult.trade.ilike(f"%{trade}%"))
        results = query.all()
        return [r.to_dict() for r in results]
    finally:
        db.close()
