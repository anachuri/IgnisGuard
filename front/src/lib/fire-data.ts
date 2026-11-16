import type {
  DateMode,
  FireDataset,
  Location,
  Prediction,
  RiskLevel,
} from "./types";

const DAY_MS = 86_400_000;

export function hashString(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const DATASET_YEARS = 20;
const datasetCache = new Map<string, FireDataset>();

/**
 * Construye una serie mensual determinista de los últimos 20 años.
 * El total de FRP coincide con el acumulado histórico del sitio.
 */
export function buildFireDataset(
  location: Location,
  today: string,
): FireDataset {
  const currentYear = Number(today.slice(0, 4));
  const cacheKey = `${location.id}-${currentYear}`;
  const cached = datasetCache.get(cacheKey);
  if (cached) return cached;

  const years = Array.from(
    { length: DATASET_YEARS },
    (_, index) => currentYear - DATASET_YEARS + index,
  );
  const random = mulberry32(hashString(`${location.id}-seasonality`));
  const cells: FireDataset["cells"] = [];
  const monthlyTotals = new Array<number>(12).fill(0);
  let rawTotal = 0;
  let maxIntensity = 0;

  const raw: number[][] = years.map((_, yearIndex) => {
    const trend = 0.82 + (yearIndex / (DATASET_YEARS - 1)) * 0.32;

    return Array.from({ length: 12 }, (_, month) => {
      const noise = 0.55 + random() * 0.9;
      const pulse = random() > 0.93 ? 1.5 + random() * 0.8 : 1;
      const value = Math.max(
        0.035,
        location.season[month] ** 1.15 * trend * noise * pulse,
      );
      rawTotal += value;
      monthlyTotals[month] += value;
      if (value > maxIntensity) maxIntensity = value;
      return value;
    });
  });

  years.forEach((year, yearIndex) => {
    raw[yearIndex].forEach((value, month) => {
      const frp = (value / rawTotal) * location.frpTotalGw;
      const detections = Math.round(frp * (46 + random() * 12));
      cells.push({
        year,
        month,
        intensity: clamp(value / maxIntensity, 0.02, 1),
        frp: Math.round(frp * 10) / 10,
        detections,
      });
    });
  });

  const peakMonth = monthlyTotals.indexOf(Math.max(...monthlyTotals));
  const dataset: FireDataset = {
    cells,
    years,
    peakMonth,
    totalDetections: cells.reduce((total, cell) => total + cell.detections, 0),
    totalFrp: location.frpTotalGw,
  };

  datasetCache.set(cacheKey, dataset);
  return dataset;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getDateMode(isoDate: string, today: string): DateMode {
  if (isoDate > today) return "forecast";
  if (isoDate < today) return "historical";
  return "live";
}

export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  return new Date(date.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function seasonalWeight(season: readonly number[], date: Date): number {
  const month = date.getUTCMonth();
  const nextMonth = (month + 1) % 12;
  const progress = date.getUTCDate() / 31;
  return season[month] * (1 - progress) + season[nextMonth] * progress;
}

function riskFromProbability(probability: number): RiskLevel {
  if (probability < 30) return "Low";
  if (probability < 55) return "Moderate";
  if (probability < 85) return "High";
  return "Extreme";
}

function conditionFromLevel(level: RiskLevel): string {
  switch (level) {
    case "Low":
      return "low risk";
    case "Moderate":
      return "moderate risk";
    case "High":
      return "high risk";
    case "Extreme":
      return "extreme risk";
  }
}

function seasonLabelFromWeight(weight: number): string {
  if (weight >= 0.8) return "Critical season";
  if (weight >= 0.55) return "High season";
  if (weight >= 0.3) return "Moderate season";
  return "Low season";
}

/**
 * Modelo demostrativo: imita la salida de un clasificador XGBoost.
 * Es determinista para una combinación ubicación + fecha.
 */
export function buildPrediction(
  location: Location,
  isoDate: string,
  today: string,
): Prediction {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const random = mulberry32(hashString(`${location.id}-${isoDate}-xgboost`));
  const seasonal = seasonalWeight(location.season, date);
  const year = date.getUTCFullYear();
  const currentYear = Number(today.slice(0, 4));
  const yearsAhead = Math.max(0, year - currentYear);
  const noise = random();

  const probability =
    Math.round(
      clamp(
        0.06 +
          location.baselineRisk * 0.34 +
          seasonal * 0.44 +
          noise * 0.08 +
          yearsAhead * 0.012,
        0.05,
        0.97,
      ) * 1000,
    ) / 10;

  const level = riskFromProbability(probability);
  const confidence = Math.round(83 + random() * 10);
  const temperature = 1.4 + seasonal * 2.6 + random() * 0.8;
  const humidity = clamp(
    location.dryness.humidity - seasonal * 4 + random() * 2,
    4,
    40,
  );
  const wind = 12 + seasonal * 28 + random() * 8;

  return {
    probability,
    level,
    conditionLabel: conditionFromLevel(level),
    confidence,
    seasonLabel: seasonLabelFromWeight(seasonal),
    drivers: [
      { label: "Thermal anomaly", value: `+${temperature.toFixed(1)} °C` },
      { label: "Vegetation humidity", value: `${humidity.toFixed(1)} %` },
      { label: "Sustained wind", value: `${Math.round(wind)} km/h` },
      {
        label: "Dry biomass",
        value: `${location.dryness.fuelLoad} %`,
      },
    ],
  };
}
