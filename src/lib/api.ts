import type { PlayerCandidate, MatchupResult, MetaResponse, EspnRosterPlayer } from './types';

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { error?: string; note?: string });
    const message = [body.error, body.note].filter(Boolean).join(' ') || `Request failed (HTTP ${res.status}).`;
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => fetch('/api/meta').then((r) => asJson<MetaResponse>(r)),

  searchPlayers: (q: string) =>
    fetch(`/api/players/search?q=${encodeURIComponent(q)}`).then((r) => asJson<{ results: PlayerCandidate[] }>(r)),

  playerByEspnId: (espnId: string) =>
    fetch(`/api/players/by-espn/${encodeURIComponent(espnId)}`).then((r) => asJson<{ player: PlayerCandidate }>(r)),

  matchup: (gsisId: string) => fetch(`/api/matchup/${gsisId}`).then((r) => asJson<MatchupResult>(r)),

  refresh: () => fetch('/api/refresh', { method: 'POST' }).then((r) => asJson<{ ok: boolean }>(r)),

  espnRoster: (payload: { leagueId: string; season: number; teamId: number; espnS2?: string; swid?: string }) =>
    fetch('/api/espn/roster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((r) => asJson<{ roster: EspnRosterPlayer[] }>(r)),
};
