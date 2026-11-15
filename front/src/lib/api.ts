import { hashString, mulberry32 } from "./fire-data";
import { LOCATIONS } from "./locations";
import type {
  DrynessLevel,
  FireDataset,
  FirePoint,
  Location,
  Severity,
} from "./types";
import { clamp } from "./utils";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"
).replace(/\/+$/, "");

export interface ApiRegion {
  id: number;
  name: string;
  lat: number;
  lon: number;
}

export interface CalendarRow {
  y: number;
  m: number;
  cells: number;
  frp: number;
}

export interface ApiFirePoint {
  cell: string;
  lat: number;
  lon: number;
  n_modis: number;
  n_viirs: number;
  frp_max: number;
  agreement: number;
}

export interface FiresResponse {
  date: string;
  count: number;
  points: ApiFirePoint[];
}

export interface OnThisDayRow {
  y: number;
  cells: number;
  frp: number;
}

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new ApiError(`API error ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

export function getRegions(signal?: AbortSignal): Promise<ApiRegion[]> {
  return get<ApiRegion[]>("/regions", signal);
}

export function getCalendar(
  region: number,
  from: number,
  to: number,
  signal?: AbortSignal,
): Promise<CalendarRow[]> {
  const params = new URLSearchParams({
    region: String(region),
    from: String(from),
    to: String(to),
  });

  return get<CalendarRow[]>(`/calendar?${params}`, signal);
}

export function getFires(
  region: number,
  day: string,
  signal?: AbortSignal,
): Promise<FiresResponse> {
  const params = new URLSearchParams({ region: String(region), day });

  return get<FiresResponse>(`/fires?${params}`, signal);
}

export function getOnThisDay(
  region: number,
  month: number,
  day: number,
  signal?: AbortSignal,
): Promise<OnThisDayRow[]> {
  const params = new URLSearchParams({
    region: String(region),
    month: String(month),
    day: String(day),
  });

  return get<OnThisDayRow[]>(`/on-this-day?${params}`, signal);
}

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function drynessLevel(score: number): DrynessLevel {
  if (score < 35) return "Bajo";
  if (score < 60) return "Moderado";
  if (score < 80) return "Alto";
  return "Crítico";
}

function severityLevel(value: number): Severity {
  if (value < 0.3) return "Baja";
  if (value < 0.55) return "Media";
  if (value < 0.8) return "Alta";
  return "Extrema";
}

function buildRegionLocation(region: ApiRegion): Location {
  const random = mulberry32(hashString(`region-${region.id}-${region.name}`));
  const score = Math.round(38 + random() * 54);
  const humidity = Math.round((8 + random() * 18) * 10) / 10;
  const fuelLoad = Math.round(42 + random() * 50);
  const baselineRisk = Math.round((0.28 + random() * 0.55) * 100) / 100;
  const lastFireYear = new Date().getUTCFullYear() - Math.floor(random() * 6);

  const season = Array.from({ length: 12 }, (_, month) => {
    const distance = Math.min(Math.abs(month - 8), 12 - Math.abs(month - 8));
    return (
      Math.round((0.18 + (1 - distance / 6) * 0.78 + random() * 0.05) * 100) /
      100
    );
  });

  return {
    id: `api-${region.id}`,
    apiId: region.id,
    name: region.name,
    province: region.name,
    country: "",
    lat: region.lat,
    lon: region.lon,
    biome: "Región monitoreada",
    frpTotalGw: Math.round((400 + random() * 2400) * 10) / 10,
    baselineRisk,
    season,
    dryness: {
      score,
      level: drynessLevel(score),
      humidity,
      fuelLoad,
    },
    recovery: {
      percent: Math.round(42 + random() * 52),
      severity: severityLevel(random()),
      lastFireYear,
      monthsSince: Math.max(1, Math.round(random() * 60)),
    },
  };
}

/**
 * Fusiona las regiones que devuelve la API con la metadata local (bioma,
 * estacionalidad, sequedad y recuperación) usando el nombre como clave.
 * Las regiones desconocidas reciben valores deterministas de respaldo.
 */
export function mergeApiRegions(regions: ApiRegion[]): Location[] {
  const localByName = new Map(
    LOCATIONS.map((location) => [normalizeName(location.name), location]),
  );

  return regions.map((region) => {
    const local = localByName.get(normalizeName(region.name));

    if (!local) return buildRegionLocation(region);

    return {
      ...local,
      apiId: region.id,
      name: region.name,
      lat: region.lat,
      lon: region.lon,
    };
  });
}

export function toFireDataset(
  rows: CalendarRow[],
  fromYear: number,
  toYear: number,
): FireDataset {
  const years = Array.from(
    { length: toYear - fromYear + 1 },
    (_, index) => fromYear + index,
  );
  const byMonth = new Map<string, CalendarRow>();

  for (const row of rows) {
    if (row.m < 1 || row.m > 12) continue;
    byMonth.set(`${row.y}-${row.m}`, row);
  }

  let maxCells = 0;
  for (const row of rows) {
    if (row.cells > maxCells) maxCells = row.cells;
  }

  const cells: FireDataset["cells"] = [];
  const monthlyFrp = new Array<number>(12).fill(0);
  let totalDetections = 0;
  let totalFrp = 0;

  for (const year of years) {
    for (let month = 0; month < 12; month++) {
      const row = byMonth.get(`${year}-${month + 1}`);
      const detections = row?.cells ?? 0;
      const frp = row?.frp ?? 0;
      const intensity =
        maxCells > 0 && detections > 0
          ? clamp(detections / maxCells, 0.04, 1)
          : 0;

      totalDetections += detections;
      totalFrp += frp;
      monthlyFrp[month] += frp;

      cells.push({
        year,
        month,
        intensity,
        frp: Math.round(frp * 10) / 10,
        detections,
      });
    }
  }

  const peakMonth = monthlyFrp.indexOf(Math.max(...monthlyFrp));

  return {
    cells,
    years,
    peakMonth: peakMonth === -1 ? 0 : peakMonth,
    totalDetections,
    totalFrp: Math.round(totalFrp * 10) / 10,
  };
}

export function toFirePoints(response: FiresResponse): FirePoint[] {
  const maxFrp = Math.max(
    1,
    ...response.points.map((point) => point.frp_max ?? 0),
  );

  return response.points.map((point) => ({
    id: point.cell,
    lat: point.lat,
    lon: point.lon,
    intensity: clamp((point.frp_max ?? 0) / maxFrp, 0.12, 1),
    frp: Math.round((point.frp_max ?? 0) * 10) / 10,
    agreement: point.agreement,
  }));
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
