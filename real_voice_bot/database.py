"""
database.py — Supabase-only persistence for AI SkillFit.
SQLite is completely abandoned. All data goes to and comes from Supabase.
"""

import os
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger("skillfit.database")


# ── Supabase client ──────────────────────────────────────────────────────────
def get_supabase():
    """Returns a Supabase service-role client. Raises if not configured."""
    from supabase import create_client
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env")
    return create_client(url, key)


# ── Category detection ───────────────────────────────────────────────────────
_CATEGORY_MAP: dict[str, str] | None = None


def _build_category_map() -> dict[str, str]:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    mapping = {
        "Blue-collar-Trades.json": "Blue-collar Trades",
        "Polytechnic-Skilled-Roles.json": "Polytechnic-Skilled Roles",
        "Semi-Skilled-Workforce.json": "Semi-Skilled Workforce",
    }
    result: dict[str, str] = {}
    for filename, category in mapping.items():
        path = os.path.join(base_dir, filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for trade_key in data:
                result[trade_key.lower().strip()] = category
        except FileNotFoundError:
            logger.warning(f"[DB] Question bank not found: {filename}")
    return result


def get_category_for_trade(trade: str) -> str:
    global _CATEGORY_MAP
    if _CATEGORY_MAP is None:
        _CATEGORY_MAP = _build_category_map()
    return _CATEGORY_MAP.get(trade.lower().strip(), "Unknown")


# ── Scoring helpers ──────────────────────────────────────────────────────────
def calculate_confidence_score(scores: list, weak_topics: list) -> int:
    """Returns 0-100 confidence score as integer (Supabase column is INTEGER)."""
    if not scores:
        return 0

    avg = sum(scores) / len(scores)
    avg_pct = (avg / 10.0) * 100

    mean = avg
    variance = sum((s - mean) ** 2 for s in scores) / len(scores)
    consistency_pct = max(0.0, 100.0 - (variance / 25.0) * 100.0)

    total = len(scores)
    weak_count = len(weak_topics)
    coverage_pct = max(0.0, ((total - weak_count) / total) * 100.0) if total > 0 else 100.0

    confidence = (avg_pct * 0.60) + (consistency_pct * 0.25) + (coverage_pct * 0.15)
    return int(round(min(100.0, max(0.0, confidence))))


def check_integrity_flag(scores: list, average_score: float) -> bool:
    if not scores or len(scores) < 3:
        return False
    if len(set(scores)) == 1:
        return True
    if average_score >= 9.5:
        return True
    mean = sum(scores) / len(scores)
    std_dev = (sum((s - mean) ** 2 for s in scores) / len(scores)) ** 0.5
    if std_dev > 3.5:
        return True
    return False


# ── Save result ──────────────────────────────────────────────────────────────
def save_result(
    candidate_name: str,
    phone_number: str,
    trade: str,
    scores: list,
    weak_topics: list,
    fitment: str,
    average_score: float,
    language: str = "English",
    district: str | None = None,
    feedback: dict | None = None,
    transcript: list | None = None,
    email: str | None = None,
    job_id: str | None = None,
) -> str:
    """
    Saves interview result directly to Supabase.
    Returns the Supabase UUID of the inserted row.
    Uses email as the primary identifier for profile lookup (unique & always filled).
    Falls back to phone_number if email is not provided.
    """
    client = get_supabase()

    category = get_category_for_trade(trade)
    confidence_score = calculate_confidence_score(scores, weak_topics)
    integrity_flag = check_integrity_flag(scores, average_score)

    # Look up user profile — email first (unique & always filled), then phone fallback
    user_id = None
    resolved_district = district
    if email:
        try:
            resp = client.table("profiles").select("id, district").eq("email", email).limit(1).execute()
            if resp.data:
                user_id = resp.data[0]["id"]
                if not resolved_district:
                    resolved_district = resp.data[0].get("district")
                logger.info(f"[DB] Profile found by email: {email} → user_id={user_id}")
        except Exception as e:
            logger.warning(f"[DB] Profile lookup by email failed (non-fatal): {e}")

    if not user_id and phone_number:
        try:
            resp = client.table("profiles").select("id, district").eq("phone", phone_number).limit(1).execute()
            if resp.data:
                user_id = resp.data[0]["id"]
                if not resolved_district:
                    resolved_district = resp.data[0].get("district")
                logger.info(f"[DB] Profile found by phone: {phone_number} → user_id={user_id}")
        except Exception as e:
            logger.warning(f"[DB] Profile lookup by phone failed (non-fatal): {e}")

    payload = {
        "candidate_name": candidate_name,
        "phone_number": phone_number,
        "trade": trade,
        "language": language,
        "district": resolved_district,
        "category": category,
        "scores": scores,
        "weak_topics": weak_topics,
        "fitment": fitment,
        "average_score": float(average_score),
        "confidence_score": confidence_score,
        "integrity_flag": integrity_flag,
        "feedback": feedback or {},
        "transcript": transcript or [],
    }

    if user_id:
        payload["user_id"] = user_id

    if job_id:
        payload["job_id"] = job_id
        logger.info(f"[DB] Linking interview to job_id={job_id}")

    try:
        resp = client.table("interviews").insert(payload).execute()
    except Exception as e:
        err_str = str(e)
        # If fitment constraint blocks "Requires Manual Verification",
        # fall back to "Requires Significant Upskilling" until SQL migration is run
        if "interviews_fitment_check" in err_str and fitment == "Requires Manual Verification":
            logger.warning("[DB] Fitment constraint blocks 'Requires Manual Verification' — run fix_rls_policies.sql in Supabase. Saving as 'Requires Significant Upskilling' temporarily.")
            payload["fitment"] = "Requires Significant Upskilling"
            resp = client.table("interviews").insert(payload).execute()
        else:
            raise

    if not resp.data:
        raise RuntimeError("Supabase insert returned no data")

    inserted_id = resp.data[0]["id"]
    logger.info(
        f"[DB] Saved to Supabase — ID={inserted_id}, "
        f"candidate={candidate_name}, email={email}, fitment={fitment}, "
        f"score={average_score}, confidence={confidence_score}%"
    )
    return inserted_id


# ── Fetch results ────────────────────────────────────────────────────────────
def get_results(
    trade: str | None = None,
    fitment: str | None = None,
    category: str | None = None,
    language: str | None = None,
    district: str | None = None,
    min_score: float | None = None,
    max_score: float | None = None,
    integrity_flag: bool | None = None,
) -> list[dict]:
    """Fetches interview results from Supabase with optional filters. Newest first."""
    client = get_supabase()

    query = client.table("interviews").select(
        "id, candidate_name, phone_number, trade, language, district, category, "
        "fitment, average_score, confidence_score, integrity_flag, "
        "scores, weak_topics, feedback, transcript, created_at, user_id"
    ).order("created_at", desc=True)

    if trade:
        query = query.ilike("trade", f"%{trade}%")
    if fitment:
        query = query.ilike("fitment", f"%{fitment}%")
    if category:
        query = query.ilike("category", f"%{category}%")
    if language:
        query = query.ilike("language", f"%{language}%")
    if district:
        query = query.ilike("district", f"%{district}%")
    if min_score is not None:
        query = query.gte("average_score", min_score)
    if max_score is not None:
        query = query.lte("average_score", max_score)
    if integrity_flag is not None:
        query = query.eq("integrity_flag", integrity_flag)

    resp = query.execute()
    results = resp.data or []

    # Normalise field names for API compatibility
    for r in results:
        r["interview_date"] = r.pop("created_at", None)

    return results


def get_result_by_phone(phone_number: str) -> dict | None:
    """Fetches the most recent result for a candidate by phone number."""
    client = get_supabase()
    resp = (
        client.table("interviews")
        .select(
            "id, candidate_name, phone_number, trade, language, district, category, "
            "fitment, average_score, confidence_score, integrity_flag, "
            "scores, weak_topics, feedback, transcript, created_at"
        )
        .eq("phone_number", phone_number)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not resp.data:
        return None
    r = resp.data[0]
    r["interview_date"] = r.pop("created_at", None)
    return r


def get_result_by_name(candidate_name: str, after_timestamp: str | None = None) -> dict | None:
    """
    Fetches the most recent result for a candidate by name.
    Optionally filters to results saved after a given ISO timestamp.
    """
    client = get_supabase()
    query = (
        client.table("interviews")
        .select(
            "id, candidate_name, phone_number, trade, language, district, category, "
            "fitment, average_score, confidence_score, integrity_flag, "
            "scores, weak_topics, feedback, transcript, created_at, user_id"
        )
        .ilike("candidate_name", candidate_name)
        .order("created_at", desc=True)
        .limit(1)
    )
    if after_timestamp:
        query = query.gte("created_at", after_timestamp)

    resp = query.execute()
    if not resp.data:
        return None
    r = resp.data[0]
    r["interview_date"] = r.pop("created_at", None)
    return r


def get_result_by_email(email: str, after_timestamp: str | None = None) -> dict | None:
    """
    Fetches the most recent interview result for a candidate by email.
    Looks up the user_id from profiles table, then finds their latest interview.
    """
    client = get_supabase()

    # 1. Resolve email → user_id via profiles
    try:
        profile_resp = client.table("profiles").select("id").eq("email", email).limit(1).execute()
        if not profile_resp.data:
            return None
        user_id = profile_resp.data[0]["id"]
    except Exception as e:
        logger.warning(f"[DB] Profile lookup by email failed: {e}")
        return None

    # 2. Fetch latest interview for this user_id
    query = (
        client.table("interviews")
        .select(
            "id, candidate_name, phone_number, trade, language, district, category, "
            "fitment, average_score, confidence_score, integrity_flag, "
            "scores, weak_topics, feedback, transcript, created_at, user_id"
        )
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(1)
    )
    if after_timestamp:
        query = query.gte("created_at", after_timestamp)

    resp = query.execute()
    if not resp.data:
        return None
    r = resp.data[0]
    r["interview_date"] = r.pop("created_at", None)
    return r


def get_latest_result(after_timestamp: str | None = None, phone_number: str | None = None) -> dict | None:
    """
    Fetches the single most recent interview result.
    - If phone_number is provided, filters by that phone number.
    - If after_timestamp is provided, only returns results saved after that time.
    This is the most reliable way to get the result right after an interview ends.
    """
    client = get_supabase()
    query = (
        client.table("interviews")
        .select(
            "id, candidate_name, phone_number, trade, language, district, category, "
            "fitment, average_score, confidence_score, integrity_flag, "
            "scores, weak_topics, feedback, transcript, created_at"
        )
        .order("created_at", desc=True)
        .limit(1)
    )
    if phone_number:  # only filter by phone if it's actually set
        query = query.eq("phone_number", phone_number)
    if after_timestamp:
        query = query.gte("created_at", after_timestamp)

    resp = query.execute()
    if not resp.data:
        return None
    r = resp.data[0]
    r["interview_date"] = r.pop("created_at", None)
    return r
