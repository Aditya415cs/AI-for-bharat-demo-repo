"""
server.py — FastAPI backend for AI SkillFit.
All interview data is stored in and read from Supabase directly.
SQLite is no longer used.
"""

import os
import logging
from uuid import uuid4

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from livekit import api

from database import save_result, get_results, get_result_by_phone, get_result_by_name, get_latest_result, get_result_by_email

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("skillfit.server")

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "wss://voice-bot-szlvcdo4.livekit.cloud")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")

app = FastAPI(
    title="AI SkillFit Backend",
    description="Government skill assessment platform — Supabase-backed",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Schemas ──────────────────────────────────────────────────────────────────

class StartInterviewRequest(BaseModel):
    candidate_name: str
    trade: str
    phone_number: str
    email: str = ""
    job_id: str = ""


class StartInterviewResponse(BaseModel):
    token: str
    room: str
    url: str


class SaveResultRequest(BaseModel):
    candidate_name: str
    phone_number: str
    trade: str
    scores: list
    weak_topics: list
    fitment: str
    average_score: float
    language: str = "English"
    district: str | None = None
    feedback: dict | None = None
    transcript: list | None = None
    email: str | None = None


class SaveResultResponse(BaseModel):
    status: str
    id: str  # Supabase UUID


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/start-interview", response_model=StartInterviewResponse)
async def start_interview(req: StartInterviewRequest):
    short_id = uuid4().hex[:8]
    room_name = f"interview-{req.phone_number}-{short_id}"
    logger.info(f"[Server] Starting interview — room={room_name}, candidate={req.candidate_name}")

    try:
        lkapi = api.LiveKitAPI(url=LIVEKIT_URL, api_key=LIVEKIT_API_KEY, api_secret=LIVEKIT_API_SECRET)

        import json as _json
        room_metadata = _json.dumps({
            "candidate_name": req.candidate_name,
            "trade": req.trade,
            "phone_number": req.phone_number,
            "email": req.email,
            "job_id": req.job_id,
        })

        await lkapi.room.create_room(
            api.CreateRoomRequest(
                name=room_name,
                empty_timeout=600,
                max_participants=2,
                metadata=room_metadata,
            )
        )

        await lkapi.agent_dispatch.create_dispatch(
            api.CreateAgentDispatchRequest(
                agent_name="skillfit-agent",
                room=room_name,
                metadata=room_metadata,
            )
        )

        token = (
            api.AccessToken(api_key=LIVEKIT_API_KEY, api_secret=LIVEKIT_API_SECRET)
            .with_identity(f"candidate-{req.phone_number}")
            .with_name(req.candidate_name)
            .with_grants(api.VideoGrants(room_join=True, room=room_name))
            .to_jwt()
        )

        await lkapi.aclose()
        return StartInterviewResponse(token=token, room=room_name, url=LIVEKIT_URL)

    except Exception as e:
        logger.error(f"[Server] Failed to start interview: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/save-result", response_model=SaveResultResponse)
async def save_result_endpoint(req: SaveResultRequest):
    """Saves interview result directly to Supabase. Called by the agent."""
    try:
        inserted_id = save_result(
            candidate_name=req.candidate_name,
            phone_number=req.phone_number,
            trade=req.trade,
            scores=req.scores,
            weak_topics=req.weak_topics,
            fitment=req.fitment,
            average_score=req.average_score,
            language=req.language,
            district=req.district,
            feedback=req.feedback,
            transcript=req.transcript,
            email=req.email,
        )
        logger.info(f"[Server] Saved — ID={inserted_id}, candidate={req.candidate_name}")
        return SaveResultResponse(status="saved", id=str(inserted_id))
    except Exception as e:
        logger.error(f"[Server] Save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/results")
async def get_results_endpoint(
    trade: str | None = Query(default=None),
    fitment: str | None = Query(default=None),
    category: str | None = Query(default=None),
    language: str | None = Query(default=None),
    district: str | None = Query(default=None),
    min_score: float | None = Query(default=None),
    max_score: float | None = Query(default=None),
    integrity_flag: bool | None = Query(default=None),
):
    """Returns all interview results from Supabase, newest first."""
    try:
        return get_results(
            trade=trade, fitment=fitment, category=category,
            language=language, district=district,
            min_score=min_score, max_score=max_score,
            integrity_flag=integrity_flag,
        )
    except Exception as e:
        logger.error(f"[Server] get_results failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/results/candidate/{phone_number}")
async def get_by_phone(phone_number: str):
    """Most recent result for a candidate by phone number."""
    try:
        result = get_result_by_phone(phone_number)
        if not result:
            raise HTTPException(status_code=404, detail="No result found for this phone number.")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/results/latest")
async def get_latest(
    after: str | None = Query(default=None, description="ISO timestamp — only return results saved after this time"),
    phone: str | None = Query(default=None, description="Filter by phone number"),
):
    """
    Returns the single most recent interview result.
    Primary lookup used by the mobile app after an interview ends.
    Pass ?phone=<number>&after=<ISO> to get the result for a specific candidate's latest interview.
    """
    try:
        result = get_latest_result(after_timestamp=after, phone_number=phone)
        if not result:
            raise HTTPException(status_code=404, detail="No result found.")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/results/by-name/{candidate_name}")
async def get_by_name(candidate_name: str, after: str | None = Query(default=None)):
    """
    Most recent result for a candidate by name.
    Optional ?after=ISO_TIMESTAMP to only return results newer than that time.
    """
    try:
        result = get_result_by_name(candidate_name, after_timestamp=after)
        if not result:
            raise HTTPException(status_code=404, detail="No result found for this candidate.")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/results/candidate/by-email/{email}")
async def get_by_email(email: str, after: str | None = Query(default=None)):
    """
    Most recent result for a candidate by email.
    Primary lookup method — email is unique and always filled.
    """
    try:
        result = get_result_by_email(email, after_timestamp=after)
        if not result:
            raise HTTPException(status_code=404, detail="No result found for this email.")
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "healthy", "service": "AI SkillFit", "db": "supabase"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
