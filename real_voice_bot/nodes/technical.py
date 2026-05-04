import logging
import json
import re
from nodes.utils import get_llm, build_messages, strip_tag, load_questions_for_trade
from state import InterviewState
from database import save_result

logger = logging.getLogger("skillfit.technical")

TECHNICAL_CONVERSATION_PROMPT = """You are Priya, a warm and patient technical interviewer for AI SkillFit.
You are conducting a VOICE interview. The candidate is SPEAKING to you.

You just asked the candidate a technical question. Now you are processing their response.

IMPORTANT RULES:
- If the candidate says "repeat", "what?", "sorry?", "can you say that again",
  "I didn't understand", "one more time", or ANYTHING that suggests they want the
  question repeated — you MUST repeat the original question in a friendly way.
  Set action to "repeat".
- If the candidate says "I don't know", "not sure", "no idea", or gives a clearly
  empty/non-answer — acknowledge it kindly ("No worries, that's perfectly fine.")
  and set action to "skip".
- If the candidate gives an actual answer (even partial) — set action to "answered".
- If the candidate asks for clarification or seems confused — rephrase the question
  more simply. Set action to "repeat".

Respond ONLY with a JSON object:
{
  "action": "repeat" | "skip" | "answered",
  "spoken_response": "what Priya should say (empty string if action is answered)"
}

No markdown. Just JSON."""


def load_questions_node(state: InterviewState) -> InterviewState:
    trade = state["candidate_info"].get("trade", "")
    questions = load_questions_for_trade(trade)

    if not questions:
        logger.warning(f"[Technical] No questions found for trade: {trade}")

    logger.info(f"[Technical] Loaded {len(questions)} questions for {trade}")

    return {
        **state,
        "questions": questions,
        "question_index": 0,
        "scores": [],
        "weak_topics": [],
        "awaiting_followup": False,
        "followup_count": 0,
        "messages": [],  
        "phase": "technical_ask",
    }


def technical_ask_node(state: InterviewState) -> InterviewState:
    """Asks the current question naturally with a warm transition."""
    questions = state["questions"]
    index = state["question_index"]

    if index >= len(questions):
        return {**state, "phase": "close"}

    current_q = questions[index]
    candidate_name = state["candidate_info"].get("name", "")
    total = len(questions)

    llm = get_llm(temperature=0.6, max_tokens=120)

    if index == 0:
        context = f"This is the FIRST technical question. Warmly transition into the technical round. Address the candidate by name ({candidate_name}) and let them know you'll ask some questions about their trade. Then ask the question."
    elif index == total - 1:
        context = "This is the LAST question. Mention warmly that this is the final one before asking."
    else:
        context = "Transition naturally from the previous question. Use a brief acknowledgment like 'Alright' or 'Okay, moving on' — keep it short and warm."

    transition_prompt = f"""You are Priya, a warm professional interviewer conducting a voice interview.

{context}

Generate a natural spoken response that transitions into this question.
Include the question at the end of your response.
Keep the total response under 40 words.
No bullet points, no markdown. Speak naturally.

Question to ask: "{current_q['question']}" """

    response = llm.invoke(transition_prompt).content.strip()

    logger.info(f"[Technical] Asking Q{index + 1}/{total}: {current_q['question'][:60]}")

    return {
        **state,
        "last_response": response,
        "messages": [
            {"role": "assistant", "content": response},
        ],
        "phase": "technical_listen",
    }


def technical_score_node(state: InterviewState) -> InterviewState:
    """Processes the candidate's answer — handles repeats, scores, and decides next step."""
    questions = state["questions"]
    index = state["question_index"]
    current_q = questions[index]
    user_answer = state["last_user_input"]
    candidate_info = state["candidate_info"]

    # ── Step 1: Check if the candidate wants a repeat or gave a non-answer ──
    conversation_llm = get_llm(temperature=0.2, max_tokens=200)

    classify_prompt = f"""{TECHNICAL_CONVERSATION_PROMPT}

Original question asked: {current_q['question']}
Candidate's response: "{user_answer}"
"""

    classify_result = conversation_llm.invoke(classify_prompt)
    try:
        clean = re.sub(r"```json|```", "", classify_result.content).strip()
        classify_data = json.loads(clean)
    except Exception:
        classify_data = {"action": "answered", "spoken_response": ""}

    action = classify_data.get("action", "answered")
    spoken = classify_data.get("spoken_response", "")

    logger.info(f"[Technical] Q{index + 1} action: {action}")

    # ── Handle repeat request ──
    if action == "repeat":
        logger.info(f"[Technical] Candidate asked to repeat Q{index + 1}")
        return {
            **state,
            "last_response": spoken if spoken else f"Of course! {current_q['question']}",
            "phase": "technical_listen",  # stay on same question, wait for answer
        }

    # ── Handle skip / "I don't know" ──
    if action == "skip":
        scores = state["scores"] + [0]
        weak_topics = state["weak_topics"] + [current_q["topic"]]
        next_index = index + 1
        phase = "close" if next_index >= len(questions) else "technical_ask"

        # Generate a warm acknowledgment
        skip_response = spoken if spoken else "No worries at all, that's perfectly fine. Let's move to the next one."

        logger.info(f"[Technical] Candidate skipped Q{index + 1}, scored 0")

        return {
            **state,
            "scores": scores,
            "weak_topics": weak_topics,
            "question_index": next_index,
            "awaiting_followup": False,
            "followup_count": 0,
            "last_response": skip_response,
            "phase": phase,
        }

    # ── Step 2: Score the actual answer ──
    score_llm = get_llm(temperature=0, max_tokens=300)

    q_conversation = state.get("messages", [])
    q_history = "\n".join(f"{m['role']}: {m['content']}" for m in q_conversation)

    score_prompt = f"""You are an expert technical assessor for blue-collar and skilled trade interviews in India.
You are evaluating a VERBAL answer given in a VOICE interview — not a written exam.

CONTEXT:
- Trade: {candidate_info.get('trade')}
- Experience: {candidate_info.get('years_of_experience')}
- Topic: {current_q['topic']}
- Question: {current_q['question']}
- Ideal answer key points: {current_q['ideal_answer']}

CONVERSATION FOR THIS QUESTION:
{q_history}
user: {user_answer}

SCORING GUIDELINES:
- This is a SPOKEN interview. Candidates will use informal language, colloquial terms,
  and may explain things in their own words. That is perfectly acceptable.
- Score based on PRACTICAL UNDERSTANDING, not textbook-perfect wording.
- If the candidate demonstrates they understand the concept through examples or
  real-world experience, give credit even if they don't use technical terms.
- 8-10: Excellent — covers most key points, shows strong practical understanding
- 5-7: Partial — understands the basics but missing important aspects
- 3-4: Weak — shows some awareness but significant gaps
- 0-2: Very weak — incorrect or completely off-topic
- A score of 5-6 with gaps SHOULD trigger a follow-up to give the candidate a fair chance.
- Be FAIR but GENEROUS. When in doubt, give the benefit of the doubt.

Return ONLY a JSON object:
{{
  "score": <integer 0-10>,
  "needs_followup": <true if score is 4-7 and there are specific gaps to probe>,
  "gap": "<one sentence describing what key point was missing, empty if score >= 8>",
  "strength": "<one sentence on what the candidate got right, empty if score <= 2>",
  "is_weak": <true only if score <= 3 and the answer shows no understanding at all>
}}

No markdown. Just JSON."""

    result = score_llm.invoke(score_prompt)
    try:
        clean = re.sub(r"```json|```", "", result.content).strip()
        score_data = json.loads(clean)
    except Exception:
        score_data = {"score": 5, "needs_followup": True, "gap": "", "strength": "", "is_weak": False}

    score = score_data.get("score", 5)
    needs_followup = score_data.get("needs_followup", False)
    gap = score_data.get("gap", "")
    strength = score_data.get("strength", "")
    is_weak = score_data.get("is_weak", False)

    followup_count = state["followup_count"]

    logger.info(
        f"[Score] Q{index + 1}: {score}/10 | "
        f"Followup: {needs_followup} | Weak: {is_weak} | "
        f"Strength: {strength[:50]} | Gap: {gap[:50]}"
    )

    # ── Decision logic ──

    # Good answer (8+) or no followup needed — acknowledge and move on
    if score >= 8 or (not needs_followup and not is_weak):
        scores = state["scores"] + [score]
        next_index = index + 1
        phase = "close" if next_index >= len(questions) else "technical_ask"

        return {
            **state,
            "scores": scores,
            "question_index": next_index,
            "awaiting_followup": False,
            "followup_count": 0,
            "phase": phase,
        }

    # Weak answer with no hope of recovery — be kind and move on
    if is_weak or followup_count >= 2:
        scores = state["scores"] + [score]
        weak_topics = state["weak_topics"] + [current_q["topic"]]
        next_index = index + 1
        phase = "close" if next_index >= len(questions) else "technical_ask"

        return {
            **state,
            "scores": scores,
            "weak_topics": weak_topics,
            "question_index": next_index,
            "awaiting_followup": False,
            "followup_count": 0,
            "phase": phase,
        }

    # ── Generate a meaningful follow-up ──
    followup_llm = get_llm(temperature=0.5, max_tokens=150)

    followup_prompt = f"""You are Priya, a warm and encouraging technical interviewer.
The candidate answered a question about {current_q['topic']}.

What they got right: {strength}
What was missing: {gap}
Original question: {current_q['question']}
Their answer: {user_answer}

Generate a warm, conversational follow-up that:
1. First ACKNOWLEDGES what they got right (briefly, 1 sentence).
2. Then asks a specific follow-up question to probe the gap area.
3. The follow-up should feel like a natural continuation, not a test.
4. Keep total response under 30 words.
5. Do NOT repeat the original question. Ask something specific about the gap.

Example good follow-ups:
- "That's a good start! And what about the safety precautions — do you usually check anything before starting?"
- "Right, I see. And when it comes to [gap area], how do you typically handle that?"

Just the spoken response, nothing else."""

    followup_q = followup_llm.invoke(followup_prompt).content.strip()

    # Update per-question conversation with the answer and follow-up
    updated_messages = state.get("messages", []) + [
        {"role": "user", "content": user_answer},
        {"role": "assistant", "content": followup_q},
    ]

    logger.info(f"[Technical] Follow-up #{followup_count + 1} for Q{index + 1}: {followup_q[:60]}")

    return {
        **state,
        "scores": state["scores"] + [score],
        "awaiting_followup": True,
        "followup_count": followup_count + 1,
        "last_response": followup_q,
        "messages": updated_messages,
        "phase": "technical_listen",
    }


def close_interview_node(state: InterviewState) -> InterviewState:
    scores = state["scores"]
    avg = round(sum(scores) / len(scores), 1) if scores else 0
    weak_topics = list(set(state["weak_topics"]))
    candidate_info = state["candidate_info"]

    if avg >= 7.5:
        fitment = "Job-Ready"
    elif avg >= 5.0:
        fitment = "Requires Training"
    elif avg >= 3.0:
        fitment = "Low Confidence"
    else:
        fitment = "Requires Significant Upskilling"

    logger.info(f"[Close] Candidate: {candidate_info} | Avg: {avg} | Fitment: {fitment} | Weak: {weak_topics}")

    # ── Persist results to SQLite ──
    try:
        record_id = save_result(
            candidate_name=candidate_info.get("name", "Unknown"),
            phone_number=candidate_info.get("phone_number", ""),
            trade=candidate_info.get("trade", ""),
            scores=scores,
            weak_topics=weak_topics,
            fitment=fitment,
            average_score=avg,
        )
        logger.info(f"[Close] Results saved to DB — record ID: {record_id}")
    except Exception as e:
        logger.error(f"[Close] Failed to save results to DB: {e}")

    # Generate a warm, personalized closing
    close_llm = get_llm(temperature=0.7, max_tokens=200)

    weak_str = ""
    if weak_topics:
        weak_str = f"Areas where the candidate could improve: {', '.join(weak_topics)}."

    close_prompt = f"""You are Priya, a warm interviewer closing a voice interview.

Candidate name: {candidate_info.get('name', '')}
Trade: {candidate_info.get('trade', '')}
Average score: {avg}/10
{weak_str}

Generate a warm, encouraging closing statement. Rules:
- Thank the candidate by name for their time.
- If there are weak areas, mention them gently as "areas to keep learning about" — 
  never say "you were weak in" or anything discouraging.
- End on a positive, encouraging note.
- Keep it under 4 sentences.
- Speak naturally, no bullet points or lists.

Just the spoken response."""

    closing = close_llm.invoke(close_prompt).content.strip()

    return {
        **state,
        "last_response": closing,
        "phase": "done",
    }