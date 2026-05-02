import logging
import asyncio
import os
from dotenv import load_dotenv

from livekit.agents import JobContext, WorkerOptions, cli
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import sarvam

from nodes.icebreaker import icebreaker_node, extract_info_node
from nodes.experience import experience_node
from nodes.technical import (
    load_questions_node,
    technical_ask_node,
    technical_score_node,
    close_interview_node,
)
from state import InterviewState

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("skillfit-voice")

def get_initial_state() -> InterviewState:
    return {
        "phase": "icebreaker",
        "candidate_info": {},
        "messages": [],
        "questions": [],
        "question_index": 0,
        "scores": [],
        "weak_topics": [],
        "awaiting_followup": False,
        "followup_count": 0,
        "last_user_input": "",
        "last_response": "",
    }


def run_interview_step(state: InterviewState) -> InterviewState:
    """
    Simple phase-based dispatcher.
    Runs the correct node(s) based on state['phase'] and chains
    transitions until the graph needs to pause for user input.
    """
    MAX_STEPS = 15  # safety limit to prevent infinite loops

    for _ in range(MAX_STEPS):
        phase = state["phase"]
        logger.info(f"[Dispatcher] Phase: {phase}")

        if phase == "icebreaker":
            state = icebreaker_node(state)
            if state["phase"] == "extract_info":
                continue
            return state

        elif phase == "extract_info":
            state = extract_info_node(state)
            continue

        elif phase == "experience":
            state = experience_node(state)
            if state["phase"] == "load_questions":
                continue
            return state

        elif phase == "load_questions":
            state = load_questions_node(state)
            continue

        elif phase == "technical_ask":
            state = technical_ask_node(state)
            return state

        elif phase == "technical_listen":
            state = technical_score_node(state)
            if state["phase"] == "technical_listen":
                return state  
            continue

        elif phase == "close":
            state = close_interview_node(state)
            return state

        elif phase == "done":
            return state

        else:
            logger.error(f"[Dispatcher] Unknown phase: {phase}")
            return state

    logger.error("[Dispatcher] Hit max steps — breaking out")
    return state


class VoiceAgent(Agent):
    def __init__(self):
        super().__init__(
            instructions="You are Priya, a warm interviewer for AI SkillFit.",
            stt=sarvam.STT(
                language="unknown",
                model="saaras:v3",
                mode="transcribe",
                flush_signal=True,
            ),
            llm=None,
            tts=sarvam.TTS(
                target_language_code="en-IN",
                model="bulbul:v3",
                speaker="ritu",
            ),
        )
        self.state = get_initial_state()

    async def on_enter(self):
        greeting = (
            "Hello! Welcome to AI SkillFit. I'm Priya, your interviewer today. "
            "Could you please start by telling me your name?"
        )
        self.state["messages"] = [
            {"role": "assistant", "content": greeting}
        ]
        await self.session.say(greeting)

    async def on_user_turn_completed(self, turn_ctx, new_message):
        user_text = new_message.text_content
        if not user_text or not user_text.strip():
            return

        if self.state.get("phase") == "done":
            return

        logger.info(f"[User | Phase: {self.state['phase']}] {user_text}")

        self.state["last_user_input"] = user_text

        loop = asyncio.get_event_loop()
        self.state = await loop.run_in_executor(
            None,
            lambda: run_interview_step(self.state),
        )

        response = self.state.get("last_response", "")
        if response:
            logger.info(f"[Agent speaking] {response[:80]}")
            await self.session.say(response)


async def entrypoint(ctx: JobContext):
    # Connect to the LiveKit room 
    await ctx.connect()

    logger.info(f"Room connected: {ctx.room.name}")
    session = AgentSession(
        turn_detection="stt",
        min_endpointing_delay=1.5,
    )
    await session.start(agent=VoiceAgent(), room=ctx.room)

if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))