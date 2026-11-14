import { hashString, mulberry32 } from "./fire-data";
import type { FirePoint, Location } from "./types";

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

interface Hotspot {
  id: string;
  lat: number;
  lon: number;
  spread: number;
  weight: number;
}

const HOTSPOTS: readonly Hotspot[] = [
  { id: "cordoba", lat: -31.42, lon: -64.19, spread: 2.9, weight: 8 },
  { id: "salta", lat: -24.78, lon: -65.42, spread: 3.1, weight: 10 },
  { id: "jujuy", lat: -24.19, lon: -65.3, spread: 2.2, weight: 6 },
  { id: "chaco", lat: -27.45, lon: -58.99, spread: 3.4, weight: 9 },
  { id: "misiones", lat: -27.37, lon: -55.9, spread: 2.4, weight: 5 },
  { id: "patagonia", lat: -41.13, lon: -71.31, spread: 5.2, weight: 7 },
  { id: "delta", lat: -34.0, lon: -58.75, spread: 2.1, weight: 5 },
  { id: "pantanal", lat: -17.5, lon: -57.4, spread: 4.4, weight: 8 },
  { id: "amazon", lat: -4.2, lon: -62.4, spread: 7.5, weight: 13 },
  { id: "cerrado", lat: -12.2, lon: -47.4, spread: 5.8, weight: 10 },
  { id: "congo", lat: 0.3, lon: 22.4, spread: 7.2, weight: 9 },
  { id: "mozambique", lat: -18.2, lon: 35.1, spread: 4.8, weight: 6 },
  { id: "indonesia", lat: -1.4, lon: 113.2, spread: 5.6, weight: 7 },
  { id: "australia", lat: -33.2, lon: 147.2, spread: 6.4, weight: 8 },
  { id: "california", lat: 39.2, lon: -121.2, spread: 3.8, weight: 4 },
  { id: "siberia", lat: 57.8, lon: 95.2, spread: 8.2, weight: 5 },
  { id: "mediterraneo", lat: 38.4, lon: 22.6, spread: 3.4, weight: 4 },
];

function wrapLongitude(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/**
 * Genera focos de calor simulados tipo FIRMS / VIIRS.
 * La región seleccionada recibe mayor densidad para dar contexto local.
 */
export function generateFirePoints(
  selected: Location,
  count = 268,
): FirePoint[] {
  const random = mulberry32(hashString(`${selected.id}-firms-viirs`));
  const weighted = HOTSPOTS.map((hotspot) => ({
    ...hotspot,
    weight: hotspot.id === selected.id ? hotspot.weight * 3.1 : hotspot.weight,
  }));
  const totalWeight = weighted.reduce((total, spot) => total + spot.weight, 0);
  const points: FirePoint[] = [];

  for (let index = 0; index < count; index++) {
    let pick = random() * totalWeight;
    let hotspot = weighted[0];

    for (const candidate of weighted) {
      pick -= candidate.weight;
      if (pick <= 0) {
        hotspot = candidate;
        break;
      }
    }

    const angle = random() * TAU;
    const radius = Math.sqrt(random()) * hotspot.spread;
    const lat = hotspot.lat + Math.sin(angle) * radius * 0.82;
    const lon = wrapLongitude(
      hotspot.lon +
        (Math.cos(angle) * radius) / Math.max(0.3, Math.cos(lat * DEG)),
    );
    const intensity = 0.28 + random() ** 1.7 * 0.72;

    points.push({
      id: `fire-${index}`,
      lat: Math.max(-78, Math.min(80, lat)),
      lon,
      intensity,
      frp: Math.round((4 + random() * 142) * 10) / 10,
    });
  }

  return points;
}
