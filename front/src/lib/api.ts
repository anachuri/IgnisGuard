import { hashString, mulberry32 } from "./fire-data";
import { LOCATIONS } from "./locations";
import type {
  DrynessLevel,
  FireDataset,
  FirePoint,
  Location,
  Prediction,
  RiskLevel,
  Severity,
} from "./types";
import { clamp } from "./utils";

const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL ??
  "https://ignisguard-api.onrender.com/api"
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

/** Resumen del día: incendios registrados de una región en una fecha. */
export interface FireDaySummary {
  count: number;
  modis: number;
  viirs: number;
  frpMax: number;
  agreements: number;
}

export interface ForecastWeather {
  time: string;
  latitude: number;
  longitude: number;
  temperature_c: number;
  humidity_pct: number;
  wind_kmh: number;
  precipitation_mm: number;
  source: string;
}

export interface ForecastResponse {
  region: number;
  region_name: string;
  date: string;
  probability: number;
  level: RiskLevel;
  conditionLabel: string;
  confidence: number;
  seasonLabel: string;
  drivers: { label: string; value: string }[];
  weather: ForecastWeather;
  source?: string;
  model?: string;
}

export interface OnThisDayRow {
  y: number;
  cells: number;
  frp: number;
}

export interface RefreshRequest {
  region_id?: number;
  lat?: number;
  lon?: number;
  start: string;
  end: string;
}

export interface RefreshStatus {
  running: boolean;
  started_at: string | null;
  finished_at: string | null;
  ok: boolean | null;
  detail: string;
  request: {
    region_id?: number;
    lat?: number;
    lon?: number;
    start: string;
    end: string;
  } | null;
}

export interface GeocodeResult {
  name: string;
  display: string;
  lat: number;
  lon: number;
  type: string;
  country: string;
}

export interface ReverseResult {
  name: string | null;
  display?: string;
  country?: string;
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

/**
 * Las queries del backend aceptan `region` (polígono precargado) o el par
 * `lat`/`lon` (punto arbitrario: filtra celdas alrededor del punto).
 */
function geoParams(location: Location): Record<string, string> {
  if (location.apiId != null) return { region: String(location.apiId) };
  return {
    lat: location.lat.toFixed(4),
    lon: location.lon.toFixed(4),
  };
}

export function getRegions(signal?: AbortSignal): Promise<ApiRegion[]> {
  return get<ApiRegion[]>("/regions", signal);
}

export function geocode(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ q: query, limit: "6" });
  return get<GeocodeResult[]>(`/geocode?${params}`, signal);
}

export function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<ReverseResult> {
  const params = new URLSearchParams({
    lat: lat.toFixed(5),
    lon: lon.toFixed(5),
  });
  return get<ReverseResult>(`/reverse?${params}`, signal);
}

export function getCalendar(
  location: Location,
  from: number,
  to: number,
  signal?: AbortSignal,
): Promise<CalendarRow[]> {
  const params = new URLSearchParams({
    ...geoParams(location),
    from: String(from),
    to: String(to),
  });

  return get<CalendarRow[]>(`/calendar?${params}`, signal);
}

export function getFires(
  location: Location,
  day: string,
  signal?: AbortSignal,
): Promise<FiresResponse> {
  const params = new URLSearchParams({ ...geoParams(location), day });

  return get<FiresResponse>(`/fires?${params}`, signal);
}

/** Día del mes con actividad (para saltar del calendario mensual al día). */
export interface FireDayRow {
  day: string;
  cells: number;
  n_modis: number;
  n_viirs: number;
  frp: number;
}

export function getFireDays(
  location: Location,
  year: number,
  month: number,
  signal?: AbortSignal,
): Promise<FireDayRow[]> {
  const params = new URLSearchParams({
    ...geoParams(location),
    year: String(year),
    month: String(month),
  });

  return get<FireDayRow[]>(`/fires/daily?${params}`, signal);
}

export function getForecast(
  location: Location,
  day: string,
  signal?: AbortSignal,
): Promise<ForecastResponse> {
  const params = new URLSearchParams({
    ...geoParams(location),
    date: day,
  });

  return get<ForecastResponse>(`/forecast?${params}`, signal);
}

export function toPrediction(forecast: ForecastResponse): Prediction {
  return {
    probability: forecast.probability,
    level: forecast.level,
    conditionLabel: forecast.conditionLabel,
    confidence: forecast.confidence,
    seasonLabel: forecast.seasonLabel,
    drivers: forecast.drivers,
    source: forecast.source,
    model: forecast.model,
  };
}

async function post<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    signal,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ApiError(`API error ${response.status}`, response.status);
  }

  return (await response.json()) as T;
}

export function startRefresh(
  request: RefreshRequest,
  signal?: AbortSignal,
): Promise<{ status: string }> {
  return post<{ status: string }>("/refresh", request, signal);
}

export function getRefreshStatus(signal?: AbortSignal): Promise<RefreshStatus> {
  return get<RefreshStatus>("/refresh/status", signal);
}

/**
 * Descarga el CSV de focos (celdas H3-día) de una región en un rango.
 * Lanza ApiError si el backend rechaza el rango o no responde.
 */
export async function downloadFiresCsv(
  location: Location,
  start: string,
  end: string,
  signal?: AbortSignal,
): Promise<void> {
  const params = new URLSearchParams({
    ...geoParams(location),
    start,
    end,
  });

  const response = await fetch(`${API_BASE}/fires/export?${params}`, {
    signal,
  });

  if (!response.ok) {
    throw new ApiError(`API error ${response.status}`, response.status);
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename =
    match?.[1] ?? `ignisguard_focos_${location.id}_${start}_${end}.csv`;

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function getOnThisDay(
  location: Location,
  month: number,
  day: number,
  signal?: AbortSignal,
): Promise<OnThisDayRow[]> {
  const params = new URLSearchParams({
    ...geoParams(location),
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

/**
 * Ubicación arbitraria (geocoding o coordenadas): misma forma que una región
 * de la API pero sin `apiId` — las queries viajan como lat/lon. La curva
 * estacional se desplaza 6 meses en el hemisferio norte.
 */
export function toCustomLocation(input: {
  name: string;
  lat: number;
  lon: number;
  country?: string;
}): Location {
  const key = `geo-${input.lat.toFixed(3)}-${input.lon.toFixed(3)}`;
  const random = mulberry32(hashString(`${key}-${input.name}`));
  const score = Math.round(38 + random() * 54);
  const humidity = Math.round((8 + random() * 18) * 10) / 10;
  const fuelLoad = Math.round(42 + random() * 50);
  const baselineRisk = Math.round((0.28 + random() * 0.55) * 100) / 100;
  const lastFireYear = new Date().getUTCFullYear() - Math.floor(random() * 6);
  const peakMonth = input.lat > 23.5 ? 6 : 8;

  const season = Array.from({ length: 12 }, (_, month) => {
    const distance = Math.min(
      Math.abs(month - peakMonth),
      12 - Math.abs(month - peakMonth),
    );
    return (
      Math.round((0.18 + (1 - distance / 6) * 0.78 + random() * 0.05) * 100) /
      100
    );
  });

  return {
    id: key,
    name: input.name,
    province: input.country || "Ubicación personalizada",
    country: input.country ?? "",
    lat: input.lat,
    lon: input.lon,
    biome: "Punto personalizado",
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
    nModis: point.n_modis,
    nViirs: point.n_viirs,
    agreement: point.agreement,
  }));
}

export function toFireDaySummary(response: FiresResponse): FireDaySummary {
  let modis = 0;
  let viirs = 0;
  let frpMax = 0;
  let agreements = 0;

  for (const point of response.points) {
    modis += point.n_modis ?? 0;
    viirs += point.n_viirs ?? 0;
    if ((point.frp_max ?? 0) > frpMax) frpMax = point.frp_max ?? 0;
    if (point.agreement === 1) agreements += 1;
  }

  return {
    count: response.count ?? response.points.length,
    modis,
    viirs,
    frpMax: Math.round(frpMax * 10) / 10,
    agreements,
  };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
