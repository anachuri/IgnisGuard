export type DateMode = "historical" | "live" | "forecast";

export type LoadStatus = "idle" | "loading" | "success" | "error";

/** Horizonte de predicción en días, anclado a la fecha de consulta. */
export type ForecastHorizon = 7 | 15 | 30;

export type RiskLevel = "Bajo" | "Moderado" | "Alto" | "Extremo";

export type DrynessLevel = "Bajo" | "Moderado" | "Alto" | "Crítico";

export type Severity = "Baja" | "Media" | "Alta" | "Extrema";

export interface Location {
  id: string;
  /** Id numérico que usa el backend FastAPI. */
  apiId?: number;
  name: string;
  province: string;
  country: string;
  lat: number;
  lon: number;
  biome: string;
  /** Acumulado histórico de Fire Radiative Power, en gigavatios. */
  frpTotalGw: number;
  /** Riesgo base 0-1 usado por el modelo demostrativo. */
  baselineRisk: number;
  /** Peso estacional relativo de enero a diciembre (0-1). */
  season: readonly number[];
  dryness: {
    score: number;
    level: DrynessLevel;
    humidity: number;
    fuelLoad: number;
  };
  recovery: {
    percent: number;
    severity: Severity;
    lastFireYear: number;
    monthsSince: number;
  };
}

export interface FireCell {
  year: number;
  /** 0 = enero. */
  month: number;
  intensity: number;
  frp: number;
  detections: number;
}

export interface FireDataset {
  cells: FireCell[];
  years: number[];
  peakMonth: number;
  totalDetections: number;
  totalFrp: number;
}

export interface FirePoint {
  id: string;
  lat: number;
  lon: number;
  intensity: number;
  frp: number;
  /** 1 si MODIS y VIIRS detectaron la misma celda H3. */
  agreement?: number;
}

export interface PredictionDriver {
  label: string;
  value: string;
}

export interface Prediction {
  probability: number;
  level: RiskLevel;
  conditionLabel: string;
  confidence: number;
  seasonLabel: string;
  drivers: PredictionDriver[];
  /** Fuente meteorológica cuando la estimación viene del backend. */
  source?: string;
  /** Identificador del modelo; "heuristic-v0" es la versión demostrativa. */
  model?: string;
}
