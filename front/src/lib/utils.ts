export const MONTHS_SHORT = [
  "E",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
] as const;

export const MONTHS_LONG = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
    ...options,
  }).format(value);
}

export function formatIsoDate(isoDate: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));
}

export function weekdayFromIso(isoDate: string): string {
  const weekday = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(`${isoDate}T12:00:00Z`));

  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

// Rampa tipo cividis (azul marino -> dorado): luminancia monotónica y
// legible con daltonismo, a diferencia de una escala rojo/verde.
const HEAT_STOPS: ReadonlyArray<
  readonly [number, readonly [number, number, number]]
> = [
  [0, [12, 22, 38]],
  [0.14, [26, 50, 88]],
  [0.34, [43, 84, 127]],
  [0.54, [83, 113, 137]],
  [0.72, [139, 139, 115]],
  [0.87, [194, 176, 94]],
  [1, [254, 232, 56]],
];

export function heatColor(intensity: number, alpha = 1): string {
  const value = clamp(intensity, 0, 1);
  let lower = HEAT_STOPS[0];
  let upper = HEAT_STOPS[HEAT_STOPS.length - 1];

  for (let index = 0; index < HEAT_STOPS.length - 1; index++) {
    if (value >= HEAT_STOPS[index][0] && value <= HEAT_STOPS[index + 1][0]) {
      lower = HEAT_STOPS[index];
      upper = HEAT_STOPS[index + 1];
      break;
    }
  }

  const span = upper[0] - lower[0] || 1;
  const progress = (value - lower[0]) / span;
  const channels = lower[1].map((channel, index) =>
    Math.round(channel + (upper[1][index] - channel) * progress),
  );

  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}
