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
  candidate_name: string;
  trade: string;
  /** e.g. "Highly Fit" | "Fit" | "Needs Improvement" */
  fitment: string;
  average_score: number;
  weak_topics: string[];
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
      headers: {
        'X-API-Key': ENV.BACKEND_API_KEY,
      },
    });
  } catch (networkError) {
    throw new Error(
      'Could not reach the server. Please check your internet connection and try again.'
    );
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch results (${response.status})`);
  }

  const data = await response.json();
  return data as InterviewResult[];
}
