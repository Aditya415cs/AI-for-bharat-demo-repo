/**
 * Interview Service
 *
 * All API calls to the AI SkillFit backend live here.
 * Base URL and API key are read from environment config — never hardcoded.
 */

import { ENV } from '../config/env';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StartInterviewPayload {
  candidate_name: string;
  trade: string;
  phone_number: string;
  email: string;
  job_id?: string;
}

export interface StartInterviewResponse {
  /** LiveKit participant token */
  token: string;
  /** LiveKit room name */
  room: string;
  /** LiveKit server WebSocket URL, e.g. wss://your-livekit-host.livekit.cloud */
  url: string;
}

export interface InterviewResult {
  id: number;
  candidate_name: string;
  phone_number: string;
  trade: string;
  language: string;
  district: string | null;
  category: string;
  fitment: string;
  average_score: number;
  confidence_score: number | null;
  integrity_flag: boolean;
  scores: number[];
  weak_topics: string[];
  feedback: { strengths: string[]; improvements: string[] } | null;
  transcript: { role: string; content: string }[] | null;
  interview_date: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * POST /start-interview
 * Creates a LiveKit room, dispatches Priya, and returns connection credentials.
 */
export async function startInterview(
  payload: StartInterviewPayload
): Promise<StartInterviewResponse> {
  const url = `${ENV.BACKEND_URL}/start-interview`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ENV.BACKEND_API_KEY,
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    throw new Error(
      'Could not reach the server. Please check your internet connection and try again.'
    );
  }

  if (!response.ok) {
    let detail = `Server error (${response.status})`;
    try {
      const body = await response.json();
      if (body?.detail) detail = body.detail;
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(detail);
  }

  const data = await response.json();
  return data as StartInterviewResponse;
}

/**
 * GET /results?trade=<optional>
 * Fetches interview results, optionally filtered by trade.
 */
export async function getResults(trade?: string): Promise<InterviewResult[]> {
  const params = trade ? `?trade=${encodeURIComponent(trade)}` : '';
  const url = `${ENV.BACKEND_URL}/results${params}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { 'X-API-Key': ENV.BACKEND_API_KEY },
    });
  } catch {
    throw new Error('Could not reach the server. Please check your internet connection and try again.');
  }

  if (!response.ok) throw new Error(`Failed to fetch results (${response.status})`);
  return response.json() as Promise<InterviewResult[]>;
}

/**
 * GET /results/latest?phone=<number>&after=<ISO>
 * Returns the most recent interview result.
 * Primary method used after an interview ends — no name matching needed.
 */
export async function getLatestResult(
  phoneNumber: string,
  afterTimestamp: string
): Promise<InterviewResult> {
  const params = new URLSearchParams();
  if (phoneNumber) params.set('phone', phoneNumber);
  if (afterTimestamp) params.set('after', afterTimestamp);
  const url = `${ENV.BACKEND_URL}/results/latest?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { 'X-API-Key': ENV.BACKEND_API_KEY },
    });
  } catch {
    throw new Error('Could not reach the server.');
  }

  if (!response.ok) {
    if (response.status === 404) throw new Error('Result not ready yet.');
    throw new Error(`Failed to fetch result (${response.status})`);
  }
  return response.json() as Promise<InterviewResult>;
}

/**
 * GET /results/by-name/:name?after=ISO_TIMESTAMP
 * Fallback lookup by candidate name.
 */
export async function getResultByName(
  candidateName: string,
  afterTimestamp?: string
): Promise<InterviewResult> {
  const params = afterTimestamp ? `?after=${encodeURIComponent(afterTimestamp)}` : '';
  const url = `${ENV.BACKEND_URL}/results/by-name/${encodeURIComponent(candidateName)}${params}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { 'X-API-Key': ENV.BACKEND_API_KEY },
    });
  } catch {
    throw new Error('Could not reach the server. Please check your internet connection.');
  }

  if (!response.ok) {
    if (response.status === 404) throw new Error('Result not ready yet.');
    throw new Error(`Failed to fetch result (${response.status})`);
  }
  return response.json() as Promise<InterviewResult>;
}

/**
 * GET /results/candidate/by-email/:email?after=ISO_TIMESTAMP
 * Primary lookup — email is unique and always filled.
 */
export async function getResultByEmail(
  email: string,
  afterTimestamp?: string
): Promise<InterviewResult> {
  const params = afterTimestamp ? `?after=${encodeURIComponent(afterTimestamp)}` : '';
  const url = `${ENV.BACKEND_URL}/results/candidate/by-email/${encodeURIComponent(email)}${params}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { 'X-API-Key': ENV.BACKEND_API_KEY },
    });
  } catch {
    throw new Error('Could not reach the server.');
  }

  if (!response.ok) {
    if (response.status === 404) throw new Error('Result not ready yet.');
    throw new Error(`Failed to fetch result (${response.status})`);
  }
  return response.json() as Promise<InterviewResult>;
}
