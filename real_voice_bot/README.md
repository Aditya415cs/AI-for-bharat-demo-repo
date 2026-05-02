# AI SkillFit — Voice Interview Bot

AI SkillFit is a **real-time voice-based interview agent** that conducts spoken skill assessments for blue-collar, polytechnic, and semi-skilled workers in India. The agent — named **Priya** — connects to a candidate over a LiveKit voice room and walks them through a structured interview entirely through natural speech.

---

## Table of Contents

- [How It Works — The Big Picture](#how-it-works--the-big-picture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [The Interview State](#the-interview-state)
- [The Phase Dispatcher](#the-phase-dispatcher)
- [Interview Phases In Detail](#interview-phases-in-detail)
  - [Phase 1: Icebreaker](#phase-1-icebreaker)
  - [Phase 2: Extract Info](#phase-2-extract-info)
  - [Phase 3: Experience](#phase-3-experience)
  - [Phase 4: Load Questions](#phase-4-load-questions)
  - [Phase 5: Technical Ask & Listen](#phase-5-technical-ask--listen)
  - [Phase 6: Close](#phase-6-close)
- [Question Bank & Selection](#question-bank--selection)
- [Scoring System](#scoring-system)
- [Follow-Up Logic](#follow-up-logic)
- [How agent.py Works](#how-agentpy-works)
- [The Original Graph Structure (graph.py)](#the-original-graph-structure-graphpy)
- [Environment Variables](#environment-variables)
- [Running the Agent](#running-the-agent)

---

## How It Works — The Big Picture

```
Candidate speaks into mic
        │
        ▼
┌──────────────────┐
│   LiveKit Room   │  Real-time voice connection
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Sarvam STT      │  Converts speech → text (Indian English)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Phase Dispatcher │  Decides which node to run based on current phase
│  (agent.py)       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Node Functions  │  icebreaker / experience / technical / close
│  (nodes/*.py)    │  Each node calls Groq LLM (Llama 3.3 70B)
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│  Sarvam TTS      │  Converts response text → speech (Indian English voice)
└──────┬───────────┘
       │
       ▼
Candidate hears Priya's response
```

The core loop is simple:
1. Candidate speaks → STT converts to text
2. Text is fed to the current interview phase's node function
3. The node calls an LLM (Groq/Llama 3.3) to generate a response
4. Response text is sent through TTS → candidate hears it
5. Repeat until the interview is complete

---

## Tech Stack

| Component | Technology | Purpose |
|---|---|---|
| Voice Rooms | [LiveKit](https://livekit.io/) | Real-time audio streaming between agent and candidate |
| Speech-to-Text | [Sarvam AI](https://www.sarvam.ai/) (`saaras:v3`) | Transcribes candidate's spoken words to text, optimized for Indian English |
| Text-to-Speech | [Sarvam AI](https://www.sarvam.ai/) (`bulbul:v3`) | Converts Priya's responses to natural-sounding Indian English speech |
| LLM | [Groq](https://groq.com/) running `llama-3.3-70b-versatile` | Powers all conversation logic — icebreaker chat, scoring, follow-ups |
| LLM Interface | [LangChain](https://www.langchain.com/) (`langchain_groq`) | Provides a clean interface to call the Groq LLM |

---

## Project Structure

```
real_voice_bot/
├── agent.py                        # Main entry point — LiveKit agent + phase dispatcher
├── state.py                        # InterviewState TypedDict definition
├── graph.py                        # Original LangGraph definition (reference only, not used at runtime)
├── .env                            # API keys and LiveKit credentials
│
├── nodes/
│   ├── __init__.py
│   ├── utils.py                    # LLM helpers, question loading logic
│   ├── icebreaker.py               # Icebreaker + info extraction nodes
│   ├── experience.py               # Experience discussion node
│   └── technical.py                # Question asking, scoring, follow-ups, closing
│
├── Blue-collar-Trades.json         # Question bank: Electrician, Plumber, Welder, etc.
├── Polytechnic-Skilled-Roles.json  # Question bank: Polytechnic-level roles
└── Semi-Skilled-Workforce.json     # Question bank: Semi-skilled positions
```

---

## The Interview State

The entire interview is driven by a single state dictionary that gets passed between nodes. It's defined in `state.py` as a Python `TypedDict`:

```python
class InterviewState(TypedDict):
    phase: str               # Current phase of the interview
    candidate_info: dict     # Extracted info: name, trade, years_of_experience
    messages: list           # Conversation history for the current phase
    questions: list          # 10 sampled technical questions
    question_index: int      # Which question we're on (0–9)
    scores: list             # Score (0–10) for each answered question
    weak_topics: list        # Topics where the candidate scored poorly
    awaiting_followup: bool  # Whether we're in the middle of a follow-up
    followup_count: int      # How many follow-ups asked for the current question
    last_user_input: str     # The most recent thing the candidate said
    last_response: str       # The text Priya should speak next
```

### Key fields explained:

- **`phase`** — This is the most important field. It controls which node function runs next. Valid values: `icebreaker`, `extract_info`, `experience`, `load_questions`, `technical_ask`, `technical_listen`, `close`, `done`.

- **`messages`** — A list of `{"role": "assistant"/"user", "content": "..."}` dicts. This serves as conversation history that gets sent to the LLM so it has context. It's scoped per phase — cleared when moving between major phases (icebreaker → experience → technical).

- **`last_user_input` / `last_response`** — These are the I/O bridge between the LiveKit agent and the node functions. The agent writes the candidate's transcribed speech to `last_user_input`, runs the dispatcher, then reads `last_response` and speaks it via TTS.

- **`questions`** — 10 questions selected from the JSON question banks, spread across topics for coverage.

- **`scores`** — One score per question. Scores accumulate as the interview progresses. At the end, the average determines the fitment level.

---

## The Phase Dispatcher

The phase dispatcher lives in `agent.py` as the `run_interview_step()` function. It replaces the original LangGraph-based execution with a simple, reliable loop.

### How it works:

```python
def run_interview_step(state):
    for _ in range(MAX_STEPS):      # Safety limit of 15 iterations
        phase = state["phase"]

        if phase == "icebreaker":
            state = icebreaker_node(state)
            if state["phase"] == "extract_info":
                continue            # Auto-chain to extract_info
            return state            # Pause — wait for user input

        elif phase == "extract_info":
            state = extract_info_node(state)
            continue                # Auto-chain to experience

        elif phase == "experience":
            state = experience_node(state)
            if state["phase"] == "load_questions":
                continue            # Auto-chain to load_questions
            return state            # Pause — wait for user input

        # ... and so on for each phase
```

The dispatcher has two behaviors per phase:
1. **Return** (pause) — When the agent has spoken something and needs to wait for the candidate's next response.
2. **Continue** (chain) — When one phase completes and the next phase should run immediately without waiting (e.g., extract_info → experience happens instantly).

### Phase transition diagram:

```
          ┌─────────┐
          │icebreaker│◄──── loops until name, trade, years collected
          └────┬─────┘
               │ [ICEBREAKER_COMPLETE] tag detected
               ▼
        ┌──────────────┐
        │ extract_info  │  extracts structured JSON from conversation
        └──────┬───────┘
               │ (auto-chains)
               ▼
         ┌────────────┐
         │ experience  │◄──── loops for 2-3 questions about work background
         └─────┬──────┘
               │ [EXPERIENCE_COMPLETE] tag detected
               ▼
       ┌────────────────┐
       │ load_questions  │  picks 10 questions from JSON bank
       └───────┬────────┘
               │ (auto-chains)
               ▼
       ┌────────────────┐
       │ technical_ask   │  asks the current question with a warm transition
       └───────┬────────┘
               │ (pauses — waits for candidate to answer)
               ▼
       ┌────────────────┐
       │technical_listen │  scores the answer, decides: next question / follow-up / close
       └───────┬────────┘
               │
          ┌────┼──────────────┐
          │    │              │
          ▼    ▼              ▼
       next  follow-up      close
      question  (loops      (when all
      (back to   back)      questions
    technical_ask)            done)
                              │
                              ▼
                         ┌────────┐
                         │  done  │
                         └────────┘
```

---

## Interview Phases In Detail

### Phase 1: Icebreaker
**File:** `nodes/icebreaker.py` → `icebreaker_node()`

The icebreaker is the opening conversation where Priya collects three pieces of information naturally:
1. Candidate's **name**
2. Their **trade/profession** (e.g., Electrician, Plumber, Welder)
3. **Years of experience**

**How it works:**
- The LLM receives the full conversation history + a system prompt that instructs it to collect these three things one at a time.
- When the LLM determines all three are confirmed, it appends a hidden tag `[ICEBREAKER_COMPLETE]` to its response.
- The node detects this tag, strips it from the spoken text (so the candidate never hears it), and transitions to `extract_info`.
- If the candidate asks Priya to repeat something ("what?", "sorry?"), the prompt instructs the LLM to repeat/rephrase instead of moving forward.

**State changes:**
- `messages` — appends user and assistant messages
- `last_response` — set to what Priya should say
- `phase` — stays `icebreaker` or moves to `extract_info`

### Phase 2: Extract Info
**File:** `nodes/icebreaker.py` → `extract_info_node()`

This is a non-conversational phase — the candidate doesn't hear anything. It takes the icebreaker conversation history and extracts structured data using the LLM.

**How it works:**
- Sends the full conversation to the LLM with instructions to return a JSON object: `{"name": "...", "trade": "...", "years_of_experience": "..."}`.
- The LLM extracts the info and returns clean JSON.
- If parsing fails, defaults to `"unknown"` for all fields.

**State changes:**
- `candidate_info` — set to the extracted dict
- `messages` — cleared (experience phase starts with a clean history)
- `phase` — set to `experience`

### Phase 3: Experience
**File:** `nodes/experience.py` → `experience_node()`

Priya asks 2-3 contextual questions about the candidate's work background. This gives the interview depth and makes the candidate comfortable before the technical round.

**How it works:**
- On the **first call**, the node sees an empty `messages` list and generates an opening question based on the extracted `candidate_info` (e.g., "You mentioned you've been working as an electrician for 5 years — what kind of work do you typically handle?").
- On **subsequent calls**, it continues the conversation naturally.
- When the LLM feels enough context has been gathered, it appends `[EXPERIENCE_COMPLETE]`, and the node transitions to `load_questions`.

**State changes:**
- `messages` — tracks the experience conversation
- `last_response` — set to Priya's response
- `phase` — stays `experience` or moves to `load_questions`

### Phase 4: Load Questions
**File:** `nodes/technical.py` → `load_questions_node()`

This is another non-conversational phase. It loads and selects 10 technical questions from the JSON question banks based on the candidate's trade.

See [Question Bank & Selection](#question-bank--selection) for the full algorithm.

**State changes:**
- `questions` — set to 10 selected questions
- `question_index` — reset to 0
- `scores`, `weak_topics` — cleared
- `phase` — set to `technical_ask`

### Phase 5: Technical Ask & Listen
**Files:** `nodes/technical.py` → `technical_ask_node()` and `technical_score_node()`

This is the core assessment loop. For each of the 10 questions:

1. **`technical_ask_node`** generates a warm transition sentence + asks the question. Sets phase to `technical_listen` and pauses for the candidate's answer.

2. **`technical_score_node`** processes the candidate's response in two steps:
   - **Step 1 — Classification:** Determines if the candidate is asking to repeat the question, saying "I don't know", or giving an actual answer.
   - **Step 2 — Scoring:** If an actual answer, scores it 0-10 using a detailed rubric. See [Scoring System](#scoring-system).
   - **Step 3 — Decision:** Based on the score, either moves to the next question, generates a follow-up, or closes. See [Follow-Up Logic](#follow-up-logic).

**State changes per question:**
- `messages` — tracks conversation for the current question (cleared per question)
- `scores` — appends the score for this question
- `weak_topics` — appends the topic if the candidate scored poorly
- `question_index` — incremented when moving to the next question
- `phase` — `technical_ask` (next question), `technical_listen` (follow-up/repeat), or `close`

### Phase 6: Close
**File:** `nodes/technical.py` → `close_interview_node()`

Generates a warm, personalized closing statement using the LLM.

**How it works:**
- Calculates the average score across all questions.
- Determines a fitment level:
  - `≥ 7.5` → **Job-Ready**
  - `≥ 5.0` → **Requires Training**
  - `≥ 3.0` → **Low Confidence**
  - `< 3.0` → **Requires Significant Upskilling**
- Sends the candidate info, score, and weak topics to the LLM to generate a warm closing message that mentions weak areas gently as "areas to keep learning about."

**State changes:**
- `last_response` — set to the closing message
- `phase` — set to `done`

---

## Question Bank & Selection

### JSON Structure

Questions are stored in three JSON files, each covering a category of trades:

```
Blue-collar-Trades.json         → Electrician, Plumber, Welder, Carpenter, Mason, ...
Polytechnic-Skilled-Roles.json  → Polytechnic-level roles
Semi-Skilled-Workforce.json     → Semi-skilled positions
```

Each file is a dict of `trade → topics → questions`:

```json
{
  "Electrician": {
    "Basic Electrical Concepts": [
      {
        "question": "What is Ohm's Law?",
        "ideal_answer": "Ohm's Law states that voltage equals current multiplied by resistance, represented as V = I × R."
      },
      ...
    ],
    "Safety Practices": [ ... ],
    ...
  },
  "Plumber": { ... },
  ...
}
```

Each question has two fields:
- `question` — What Priya asks the candidate
- `ideal_answer` — Key points used by the scoring LLM to evaluate the candidate's response

### Selection Algorithm (`load_questions_for_trade` in `utils.py`)

The goal is to pick **10 questions spread across all topics** for fair coverage:

1. **Find the trade** — Searches all three JSON files for a case-insensitive match on the candidate's trade.
2. **Bucket by topic** — Groups all questions by their topic.
3. **Shuffle within buckets** — Randomizes question order within each topic.
4. **Round-robin selection** — Picks one question from each topic in rotation until 10 are selected. This ensures no single topic dominates.
5. **Final shuffle** — Shuffles the 10 selected questions so topics aren't asked in a predictable order.

Example: If a trade has 4 topics with 5 questions each, the selection picks ~2-3 questions from each topic.

---

## Scoring System

Scoring happens in `technical_score_node()` and uses a detailed LLM prompt with clear rubrics.

### Scoring Rubric

| Score Range | Label | Meaning |
|---|---|---|
| 8–10 | Excellent | Covers most key points, shows strong practical understanding |
| 5–7 | Partial | Understands the basics but missing important aspects |
| 3–4 | Weak | Shows some awareness but has significant gaps |
| 0–2 | Very weak | Incorrect or completely off-topic |

### Key Scoring Principles

1. **Verbal-first evaluation** — The scorer is explicitly told this is a spoken interview. Informal language, colloquial terms, and explaining concepts "in their own words" are perfectly acceptable.

2. **Practical understanding over textbook wording** — If a candidate demonstrates they understand a concept through real-world examples, they get credit even without using technical terminology.

3. **Fair but generous** — The prompt instructs: "When in doubt, give the benefit of the doubt."

4. **Context-aware** — The scorer sees the candidate's trade, years of experience, the question topic, the ideal answer, and the full conversation for that question (including any follow-ups).

### Scoring Output

The LLM returns a JSON object:

```json
{
  "score": 6,
  "needs_followup": true,
  "gap": "Did not mention safety precautions before starting work",
  "strength": "Correctly identified the basic procedure",
  "is_weak": false
}
```

- `score` — Integer 0-10
- `needs_followup` — Whether the answer has specific gaps worth probing
- `gap` — What key point was missing (used to generate targeted follow-ups)
- `strength` — What the candidate got right (acknowledged in follow-ups)
- `is_weak` — True only if score ≤ 3 and the answer shows no understanding

---

## Follow-Up Logic

Follow-ups are the mechanism that gives candidates a **fair chance** to demonstrate knowledge they might have missed in their first answer.

### When follow-ups happen

A follow-up is triggered when:
- Score is between **4 and 7** (partial understanding)
- `needs_followup` is `true` (there are specific gaps to probe)
- The candidate hasn't already been asked **2 follow-ups** for this question

### When follow-ups are skipped

The system moves to the next question when:
- Score is **8+** (good answer, no need to probe)
- Score is **≤ 3** and `is_weak` is true (answer shows no understanding — follow-up won't help)
- Already asked **2 follow-ups** for this question (max limit reached)
- `needs_followup` is false

### How follow-ups are generated

Follow-ups are generated with a specific structure:
1. **Acknowledge what the candidate got right** — "That's a good start!"
2. **Ask a specific question about the gap** — Not repeating the original question, but probing the specific area that was missing.

Example:
> "That's a good start! And what about the safety precautions — do you usually check anything before starting?"

### Conversation tracking

The `messages` field tracks the full conversation for each question. When a follow-up is asked, both the candidate's answer and the follow-up are appended to `messages`. This means when the follow-up answer is scored, the LLM has the **complete context**: original question → first answer → follow-up question → follow-up answer.

---

## How agent.py Works

`agent.py` is the main entry point and contains three key components:

### 1. VoiceAgent class

```python
class VoiceAgent(Agent):
```

Extends LiveKit's `Agent` class with:

- **`stt`** — Sarvam STT (`saaras:v3`) for speech-to-text. Set to `language="unknown"` so it auto-detects.
- **`llm`** — Set to `None` because we handle LLM calls ourselves in the node functions (via Groq), not through LiveKit's built-in pipeline.
- **`tts`** — Sarvam TTS (`bulbul:v3`) with the `ritu` speaker voice for natural Indian English output.

### 2. Lifecycle hooks

**`on_enter()`** — Called when the agent joins the room. Speaks the greeting:
> "Hello! Welcome to AI SkillFit. I'm Priya, your interviewer today. Could you please start by telling me your name?"

Uses `self.session.say(text)` to speak directly via TTS (not `generate_reply()`, which would require an LLM).

**`on_user_turn_completed()`** — Called every time the candidate finishes speaking. This is the main loop:
1. Gets the transcribed text from `new_message.text_content`
2. Sets `state["last_user_input"]` to the transcribed text
3. Runs `run_interview_step(state)` in a thread executor (node functions are synchronous)
4. Reads `state["last_response"]` and speaks it via `self.session.say()`

### 3. Entrypoint

```python
async def entrypoint(ctx: JobContext):
    await ctx.connect()
    session = AgentSession(turn_detection="stt", min_endpointing_delay=1.5)
    await session.start(agent=VoiceAgent(), room=ctx.room)
```

- `ctx.connect()` — Connects to the LiveKit room
- `turn_detection="stt"` — Uses STT-based turn detection (waits for silence to know the candidate stopped speaking)
- `min_endpointing_delay=1.5` — Waits 1.5 seconds of silence before assuming the candidate finished speaking. This prevents cutting off candidates who pause to think.

---

## The Original Graph Structure (graph.py)

The project originally used **LangGraph** to define the interview flow as a state graph. This file (`graph.py`) is kept as a reference but is **not imported or used at runtime**. The dispatcher in `agent.py` replaced it.

### Why it was replaced

LangGraph's `StateGraph` uses a fixed entry point. Every invocation starts at the `"icebreaker"` node regardless of the current phase. This caused routing failures when re-entering the graph in later phases (e.g., `technical_listen` phase trying to route from `icebreaker`, which only knows about `icebreaker` and `extract_info` transitions).

The phase dispatcher in `agent.py` solves this by simply looking at `state["phase"]` and calling the right function directly.

### Original graph structure (for reference):

```
icebreaker ──(conditional)──► icebreaker (loop)
                            ──► extract_info ──► experience ──(conditional)──► experience (loop)
                                                                            ──► load_questions ──► technical_ask ──► END
                                                                                                    
                                        technical_score ──(conditional)──► technical_ask
                                                                        ──► END (follow-up, wait)
                                                                        ──► close ──► END
```

---

## Environment Variables

Create a `.env` file with the following keys:

```env
SARVAM_API_KEY=<your Sarvam AI API key>
GROQ_API_KEY=<your Groq API key>
LIVEKIT_URL=<your LiveKit Cloud WebSocket URL>
LIVEKIT_API_KEY=<your LiveKit API key>
LIVEKIT_API_SECRET=<your LiveKit API secret>
```

---

## Running the Agent

```bash
python agent.py dev
```

This starts the LiveKit worker in development mode. When a participant joins the configured LiveKit room, the agent automatically connects and begins the interview.
