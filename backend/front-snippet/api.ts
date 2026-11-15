// Copiar a front/src/lib/api.ts
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
}

export const getRegions = () => get("/regions");
export const getCalendar = (region: number) =>
  get(`/calendar?region=${region}&from=2006&to=2026`);
export const getFires = (region: number, day: string) =>
  get(`/fires?region=${region}&day=${day}`);
export const getOnThisDay = (region: number, month: number, day: number) =>
  get(`/on-this-day?region=${region}&month=${month}&day=${day}`);
