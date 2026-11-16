# IgnisGuard: conectar el frontend al backend FastAPI

Este archivo es contexto para un agente de código. Objetivo: reemplazar los datos mock del frontend por llamadas reales al backend, sin romper la UI existente.

## Proyecto

NASA Space Apps Challenge Córdoba: **armonización de detecciones de incendios MODIS + VIIRS** en un calendario unificado de 20 años para analizar patrones históricos y anticipar emergencias.

- **Frontend** (`front/`): Next.js 16 + React 19 + Tailwind 4. Hoy es 100% mock: no hay fetch, axios ni rutas `app/api`.
- **Backend** (`backend/`): FastAPI + PostgreSQL + pandas/GeoPandas/H3. Ya está escrito; el front debe consumirlo.

## Reglas

1. **No rediseñar la UI.** Mantener globo, calendario, sidebar, estilos y animaciones. Solo cambia el origen de los datos.
2. Mantener las **mismas formas de datos** que hoy consumen los componentes. Si la API devuelve otra forma, adaptarla en `src/lib/api.ts` (capa de mapeo), no en los componentes.
3. Todo acceso HTTP vive en `src/lib/api.ts`. Los componentes no llaman `fetch` directamente.
4. Agregar **estado de carga y de error** reales (hoy no existen). Si la API falla, mostrar un mensaje discreto y permitir reintentar. No dejar pantalla en blanco.
5. Respetar `prefers-reduced-motion` y la accesibilidad existente.
6. No agregar dependencias pesadas. Para fetching alcanza `useEffect` + estado, o SWR si se prefiere. No introducir H3, MapLibre ni D3 en el front: el H3 se resuelve en el backend.
7. Variable de entorno: `NEXT_PUBLIC_API_URL` (default `http://localhost:8000/api`). Crear `front/.env.local.example`.

## Mapa: mock actual → endpoint

| Archivo mock del front | Qué hace hoy | Reemplazar por |
|---|---|---|
| `src/lib/locations.ts` | 7 regiones hardcodeadas | `GET /api/regions` |
| `src/lib/fire-data.ts` (serie 20 años, ~l.42) | Calendario generado con PRNG | `GET /api/calendar` |
| `src/lib/fire-points.ts` (~l.43) | Focos simulados por hotspot | `GET /api/fires` |
| `IgnisGuard.tsx` (~l.129) botón "Generar Puntos de Incendio" | `setTimeout` 1,5 s + 268 puntos simulados | Llamar `GET /api/fires` con región y fecha elegidas |
| `fire-data.ts` (~l.118) modos historical/live/forecast | Según la fecha | **Se mantiene en el front** |
| `fire-data.ts` (~l.158) predicción pseudo-XGBoost | Fórmula con ruido | **Usar `/forecast` con fallback al mock** (heurístico v0 + Meteomatics) |
| `MetricsCard.tsx` | Métricas estáticas | **Dejar el mock por ahora** (no hay `/metrics`) |
| `land-points.ts` | Continentes del globo | No tocar |

## Contrato de la API (base: `http://localhost:8000/api`)

### `GET /regions`
```json
[{ "id": 1, "name": "Córdoba", "lat": -31.4, "lon": -64.2 }]
```
Reemplaza la lista de `locations.ts`. El `id` numérico es el que se usa como `region` en el resto de los endpoints. Si `locations.ts` tiene un id string propio, mapear por nombre o agregar el campo `apiId`.

### `GET /calendar?region={id}&from=2006&to=2026`
```json
[{ "y": 2012, "m": 9, "cells": 148, "frp": 3120.5 }]
```
- Una fila por año-mes que tenga datos. **Los meses sin detecciones no vienen**: completar con 0 para que la grilla 20 × 12 quede completa.
- `cells` = cantidad de celdas H3 con fuego en ese mes (acumulado de celdas-día). `frp` = suma de FRP en MW.
- La intensidad del color del heatmap debe normalizarse en el front (por ejemplo contra el máximo de la región). Hoy el generador mock ya produce un valor por celda del calendario: reutilizar esa escala usando `cells` como valor.
- Mapear `y`/`m` a lo que espere `FireCalendar.tsx` (verificar si el mes es 0-11 o 1-12).

### `GET /fires?region={id}&day=YYYY-MM-DD`
```json
{
  "date": "2024-09-15",
  "count": 42,
  "points": [
    { "cell": "88c2e...", "lat": -31.1, "lon": -64.3,
      "n_modis": 1, "n_viirs": 5, "frp_max": 38.2, "agreement": 1 }
  ]
}
```
- El parámetro se llama **`day`** (no `date`).
- Cada punto es una celda H3 (~0,7 km²) con fuego ese día local, no un píxel crudo. `agreement = 1` significa que ambos sensores la detectaron.
- Mapear `points` a la forma que usa `fire-points.ts` / `GlobeView.tsx` (lat, lon, intensidad). Sugerencia: intensidad = `frp_max` normalizado; destacar visualmente `agreement = 1` si es barato de hacer (por ejemplo, halo más brillante).
- Puede devolver lista vacía: la UI debe mostrar "sin detecciones para esta fecha" y no fallar.

### `GET /on-this-day?region={id}&month=9&day=15`
```json
[{ "y": 2012, "cells": 10, "frp": 233.1 }]
```
Sirve para una función "un día como hoy" (qué pasó ese mismo día en cada año). **Opcional**: implementarla solo si queda tiempo, como panel pequeño en el sidebar.

## Comportamiento esperado según la fecha

- **historical** (fecha pasada): calendario real + focos reales del día elegido vía `/fires`.
- **live** (hoy): igual que historical con la fecha de hoy. Si no hay datos, mostrar estado vacío.
- **forecast** (fecha futura): no pedir `/fires` (no hay datos futuros). Pedir `GET /forecast?region={id}&date=YYYY-MM-DD` y mostrar `PredictionCard` con clima real de Meteomatics; si falla, usar el mock local como fallback.

Hoy los focos no cambian con la fecha, solo con la ubicación. Con la API deben cambiar con **región y fecha**. Refetch cuando cambie cualquiera de las dos, con debounce corto en el selector de fecha y cancelando la petición anterior (`AbortController`) para evitar carreras.

## Pasos sugeridos (en este orden)

1. Copiar `front-snippet/api.ts` a `front/src/lib/api.ts`, tiparlo (`Region`, `CalendarRow`, `FirePoint`, `FiresResponse`) y agregar `AbortSignal` opcional.
2. Crear `.env.local.example` con `NEXT_PUBLIC_API_URL`.
3. Regiones: cargar desde `/regions` con fallback a `locations.ts` si la API no responde.
4. Calendario: reemplazar el generador de `fire-data.ts` por `/calendar` y completar meses vacíos con 0.
5. Focos: conectar el botón "Generar Puntos de Incendio" a `/fires`; quitar el `setTimeout` y los 268 puntos simulados. Mostrar el estado de carga real en el botón.
6. Agregar estados de carga y error (skeleton en el calendario, mensaje en el sidebar).
7. Las métricas siguen con mock; la predicción ya usa `/forecast` con fallback al mock local.
8. Verificar con `npm run build` y `npm run lint`.

## Cómo levantar el backend para probar

```bash
cd back
docker compose up -d db
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000/docs
```
CORS solo permite `http://localhost:3000`. Si el front corre en otro puerto, editar `allow_origins` en `app/main.py`. Si todavía no hay datos cargados, los endpoints devuelven listas vacías: el front debe tolerarlo (usar el fallback al mock en desarrollo si hace falta, detrás de un flag `NEXT_PUBLIC_USE_MOCK=1`).

## Criterios de aceptación

- Cambiar de región o fecha dispara las peticiones correctas (ver Network en el navegador).
- El calendario muestra 20 años × 12 meses con datos de `/calendar`, sin huecos de layout.
- El globo muestra los focos de `/fires` para la región y fecha elegidas.
- Con el backend apagado, la app no se rompe: muestra error y permite reintentar (o usa el mock si `NEXT_PUBLIC_USE_MOCK=1`).
- `npm run build` y `npm run lint` pasan.
- No quedan `setTimeout` simulando llamadas ni datos inventados para la serie histórica.
