"use client";

import { Flame } from "lucide-react";
import { useEffect, useRef } from "react";

import { LAND_POINTS } from "@/lib/land-points";
import type { FirePoint, Location } from "@/lib/types";
import { clamp } from "@/lib/utils";

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

interface GlobeViewProps {
  location: Location;
  firePoints: FirePoint[];
  showFires: boolean;
  generating: boolean;
}

interface LandDot {
  cosPhi: number;
  sinPhi: number;
  lonRad: number;
}

function createGlowSprite(): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = 96;
  sprite.height = 96;
  const context = sprite.getContext("2d");

  if (context) {
    const gradient = context.createRadialGradient(48, 48, 0, 48, 48, 48);
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.98)");
    gradient.addColorStop(0.12, "rgba(254, 240, 138, 0.95)");
    gradient.addColorStop(0.28, "rgba(251, 146, 60, 0.65)");
    gradient.addColorStop(0.52, "rgba(239, 68, 68, 0.25)");
    gradient.addColorStop(0.78, "rgba(239, 68, 68, 0.07)");
    gradient.addColorStop(1, "rgba(239, 68, 68, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 96, 96);
  }

  return sprite;
}

export default function GlobeView({
  location,
  firePoints,
  showFires,
  generating,
}: GlobeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rotationRef = useRef(1.02);
  const tiltRef = useRef(-0.22);
  const draggingRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const resumeAtRef = useRef(0);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tipFrpRef = useRef<HTMLSpanElement | null>(null);
  const tipSensorsRef = useRef<HTMLDivElement | null>(null);
  const tipAgreementRef = useRef<HTMLDivElement | null>(null);
  const autoRotateRef = useRef(true);
  const locationIdRef = useRef(location.id);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const land: LandDot[] = LAND_POINTS.map(([lat, lon]) => {
      const phi = lat * DEG;
      return {
        cosPhi: Math.cos(phi),
        sinPhi: Math.sin(phi),
        lonRad: lon * DEG,
      };
    });

    const LAND_BUCKETS = 10;
    const landPositionBuckets: number[][] = Array.from(
      { length: LAND_BUCKETS },
      () => [],
    );
    const landStyles = Array.from({ length: LAND_BUCKETS }, (_, index) => {
      const depth = (index + 1) / LAND_BUCKETS;
      const red = Math.round(56 + 109 * depth);
      const green = Math.round(189 + 54 * depth);
      const blue = Math.round(248 + 7 * depth);
      return {
        fillStyle: `rgba(${red}, ${green}, ${blue}, ${(0.15 + depth * 0.74).toFixed(3)})`,
        width: 1.3 + depth * 1.5,
      };
    });

    const fires = firePoints.map((point) => ({
      ...point,
      cosPhi: Math.cos(point.lat * DEG),
      sinPhi: Math.sin(point.lat * DEG),
      lonRad: point.lon * DEG,
    }));

    const locationDot = {
      cosPhi: Math.cos(location.lat * DEG),
      sinPhi: Math.sin(location.lat * DEG),
      lonRad: location.lon * DEG,
    };

    // Al elegir un lugar nuevo el globo se centra en el punto y frena la
    // rotación automática; el usuario igual puede arrastrarlo o usar flechas.
    if (locationIdRef.current !== location.id) {
      locationIdRef.current = location.id;
      rotationRef.current = ((-locationDot.lonRad % TAU) + TAU) % TAU;
      autoRotateRef.current = false;
    }

    const glowSprite = createGlowSprite();
    const firesStart = performance.now();
    const mouse = { x: -1e4, y: -1e4, inside: false };
    const frameFires: { x: number; y: number; fire: FirePoint }[] = [];
    const tipShown = { id: "", w: 150, h: 60 };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let lastFrame = performance.now();

    const project = (
      cosPhi: number,
      sinPhi: number,
      lonRad: number,
      cx: number,
      cy: number,
      radius: number,
      rotation: number,
      cosTilt: number,
      sinTilt: number,
    ) => {
      const lambda = lonRad + rotation;
      const x = cosPhi * Math.sin(lambda);
      const y = -sinPhi;
      const z = cosPhi * Math.cos(lambda);
      const tiltedY = y * cosTilt - z * sinTilt;
      const tiltedZ = y * sinTilt + z * cosTilt;

      return {
        x: cx + x * radius,
        y: cy + tiltedY * radius,
        z: tiltedZ,
      };
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, width < 640 ? 1.5 : 1.75);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now: number) => {
      const delta = Math.min(64, now - lastFrame);
      lastFrame = now;

      if (
        !reducedMotion &&
        autoRotateRef.current &&
        !draggingRef.current &&
        now > resumeAtRef.current
      ) {
        rotationRef.current += delta * 0.00008;
      }

      const rotation = rotationRef.current;
      const tilt = tiltRef.current;
      const cosTilt = Math.cos(tilt);
      const sinTilt = Math.sin(tilt);

      const cx = width * 0.5;
      const cy = height * 0.5 - Math.min(16, height * 0.015);
      const radius = Math.max(108, Math.min(width * 0.46, height * 0.36, 400));
      const dotScale = radius / 340;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, width, height);

      // Halo atmosférico exterior.
      context.save();
      context.globalCompositeOperation = "lighter";
      const halo = context.createRadialGradient(
        cx,
        cy,
        radius * 0.88,
        cx,
        cy,
        radius * 1.46,
      );
      halo.addColorStop(0, "rgba(34, 211, 238, 0.18)");
      halo.addColorStop(0.38, "rgba(8, 145, 178, 0.08)");
      halo.addColorStop(0.7, "rgba(14, 116, 144, 0.025)");
      halo.addColorStop(1, "rgba(3, 7, 18, 0)");
      context.fillStyle = halo;
      context.beginPath();
      context.arc(cx, cy, radius * 1.46, 0, TAU);
      context.fill();
      context.restore();

      // Esfera oceánica.
      const ocean = context.createRadialGradient(
        cx - radius * 0.38,
        cy - radius * 0.42,
        radius * 0.06,
        cx,
        cy,
        radius * 1.02,
      );
      ocean.addColorStop(0, "#0e7490");
      ocean.addColorStop(0.3, "#0b5c7a");
      ocean.addColorStop(0.58, "#082f49");
      ocean.addColorStop(0.86, "#041c2e");
      ocean.addColorStop(1, "#01050d");
      context.fillStyle = ocean;
      context.beginPath();
      context.arc(cx, cy, radius, 0, TAU);
      context.fill();

      // Graticule sutil.
      context.strokeStyle = "rgba(125, 211, 252, 0.075)";
      context.lineWidth = 0.65;

      for (let lat = -60; lat <= 60; lat += 30) {
        context.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 5) {
          const point = project(
            Math.cos(lat * DEG),
            Math.sin(lat * DEG),
            lon * DEG,
            cx,
            cy,
            radius,
            rotation,
            cosTilt,
            sinTilt,
          );
          if (point.z > 0.015) {
            if (started) context.lineTo(point.x, point.y);
            else context.moveTo(point.x, point.y);
            started = true;
          } else {
            started = false;
          }
        }
        context.stroke();
      }

      for (let lon = -180; lon < 180; lon += 30) {
        context.beginPath();
        let started = false;
        for (let lat = -85; lat <= 85; lat += 5) {
          const point = project(
            Math.cos(lat * DEG),
            Math.sin(lat * DEG),
            lon * DEG,
            cx,
            cy,
            radius,
            rotation,
            cosTilt,
            sinTilt,
          );
          if (point.z > 0.015) {
            if (started) context.lineTo(point.x, point.y);
            else context.moveTo(point.x, point.y);
            started = true;
          } else {
            started = false;
          }
        }
        context.stroke();
      }

      // Puntos de continentes, agrupados para evitar miles de cambios de estado.
      for (const bucket of landPositionBuckets) bucket.length = 0;

      for (const dot of land) {
        const point = project(
          dot.cosPhi,
          dot.sinPhi,
          dot.lonRad,
          cx,
          cy,
          radius,
          rotation,
          cosTilt,
          sinTilt,
        );

        if (point.z <= 0.012) continue;

        const bucket = Math.min(
          LAND_BUCKETS - 1,
          Math.floor(point.z * LAND_BUCKETS),
        );
        landPositionBuckets[bucket].push(point.x, point.y);
      }

      for (let bucket = 0; bucket < LAND_BUCKETS; bucket++) {
        const positions = landPositionBuckets[bucket];
        if (positions.length === 0) continue;

        const style = landStyles[bucket];
        const size = Math.max(0.55, style.width * dotScale);
        const half = size / 2;
        context.fillStyle = style.fillStyle;
        context.beginPath();

        for (let index = 0; index < positions.length; index += 2) {
          const x = positions[index];
          const y = positions[index + 1];
          context.moveTo(x + half, y);
          context.arc(x, y, half, 0, TAU);
        }

        context.fill();
      }

      // Sombra de terminador + brillo especular.
      context.save();
      context.beginPath();
      context.arc(cx, cy, radius, 0, TAU);
      context.clip();

      const shade = context.createLinearGradient(
        cx - radius,
        cy - radius,
        cx + radius,
        cy + radius,
      );
      shade.addColorStop(0, "rgba(2, 6, 23, 0)");
      shade.addColorStop(0.52, "rgba(2, 6, 23, 0.12)");
      shade.addColorStop(1, "rgba(2, 6, 23, 0.74)");
      context.fillStyle = shade;
      context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      const sheen = context.createRadialGradient(
        cx - radius * 0.44,
        cy - radius * 0.5,
        0,
        cx - radius * 0.44,
        cy - radius * 0.5,
        radius * 0.92,
      );
      sheen.addColorStop(0, "rgba(207, 250, 254, 0.13)");
      sheen.addColorStop(0.45, "rgba(165, 243, 252, 0.04)");
      sheen.addColorStop(1, "rgba(165, 243, 252, 0)");
      context.fillStyle = sheen;
      context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      context.restore();

      // Anillo orbital decorativo con satélite.
      context.save();
      context.translate(cx, cy);
      context.rotate(-0.36);
      context.strokeStyle = "rgba(125, 211, 252, 0.16)";
      context.lineWidth = 0.8;
      context.setLineDash([2, 10]);
      context.beginPath();
      context.ellipse(0, 0, radius * 1.2, radius * 0.35, 0, 0, TAU);
      context.stroke();
      context.setLineDash([]);

      const satelliteAngle = now * 0.00022 + 0.4;
      const satelliteX = Math.cos(satelliteAngle) * radius * 1.2;
      const satelliteY = Math.sin(satelliteAngle) * radius * 0.35;
      context.fillStyle = "rgba(207, 250, 254, 0.92)";
      context.shadowColor = "rgba(34, 211, 238, 0.95)";
      context.shadowBlur = 10;
      context.beginPath();
      context.arc(satelliteX, satelliteY, 1.8, 0, TAU);
      context.fill();
      context.restore();

      // Rim light.
      context.save();
      context.strokeStyle = "rgba(103, 232, 249, 0.42)";
      context.lineWidth = 1;
      context.shadowColor = "rgba(34, 211, 238, 0.7)";
      context.shadowBlur = 16;
      context.beginPath();
      context.arc(cx, cy, radius, 0, TAU);
      context.stroke();
      context.strokeStyle = "rgba(165, 243, 252, 0.1)";
      context.lineWidth = 0.6;
      context.beginPath();
      context.arc(cx, cy, radius * 1.012, 0, TAU);
      context.stroke();
      context.restore();

      // Focos de calor FIRMS / VIIRS.
      frameFires.length = 0;
      if (showFires) {
        context.save();
        context.globalCompositeOperation = "lighter";

        for (let index = 0; index < fires.length; index++) {
          const fire = fires[index];
          const point = project(
            fire.cosPhi,
            fire.sinPhi,
            fire.lonRad,
            cx,
            cy,
            radius,
            rotation,
            cosTilt,
            sinTilt,
          );

          if (point.z <= 0.03) continue;

          const reveal = clamp((now - firesStart - index * 2.4) / 620, 0, 1);
          if (reveal <= 0) continue;

          frameFires.push({ x: point.x, y: point.y, fire });

          const flicker = 0.82 + 0.18 * Math.sin(now * 0.0026 + index * 0.91);
          const agreementBoost = fire.agreement ? 1.3 : 1;
          const glowSize =
            (11 + fire.intensity * 32) * dotScale * flicker * agreementBoost;
          const alpha =
            (0.4 + fire.intensity * 0.55) * reveal * (0.4 + point.z * 0.6);

          context.globalAlpha = alpha;
          context.drawImage(
            glowSprite,
            point.x - glowSize / 2,
            point.y - glowSize / 2,
            glowSize,
            glowSize,
          );

          context.globalAlpha = reveal * (0.55 + point.z * 0.45);
          context.fillStyle = fire.intensity > 0.68 ? "#fef9c3" : "#fdba74";
          context.beginPath();
          context.arc(
            point.x,
            point.y,
            Math.max(0.7, (0.7 + fire.intensity * 1.05) * dotScale),
            0,
            TAU,
          );
          context.fill();
        }

        context.restore();
      }

      // Hit-test: foco más cercano al cursor -> tooltip DOM.
      const tip = tooltipRef.current;
      let hovered: { x: number; y: number; fire: FirePoint } | null = null;
      if (mouse.inside && !draggingRef.current && showFires) {
        let bestD2 = 18 * 18;
        for (const candidate of frameFires) {
          const dx = candidate.x - mouse.x;
          const dy = candidate.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < bestD2) {
            bestD2 = d2;
            hovered = candidate;
          }
        }
      }

      if (tip) {
        if (!hovered) {
          tip.style.opacity = "0";
          if (!draggingRef.current) canvas.style.cursor = "grab";
        } else {
          tip.style.opacity = "1";
          if (tipShown.id !== hovered.fire.id) {
            tipShown.id = hovered.fire.id;
            const fire = hovered.fire;
            if (tipFrpRef.current) {
              tipFrpRef.current.textContent = `Max FRP ${Math.round(fire.frp)} MW`;
            }
            if (tipSensorsRef.current) {
              tipSensorsRef.current.textContent = `${fire.nViirs ?? 0}× VIIRS · ${fire.nModis ?? 0}× MODIS`;
            }
            tipAgreementRef.current?.classList.toggle(
              "hidden",
              !fire.agreement,
            );
            tipShown.w = tip.offsetWidth;
            tipShown.h = tip.offsetHeight;
          }
          // Anclado a la derecha del foco; solo se corre a la izquierda lo
          // justo para que no se salga de la pantalla.
          tip.style.transform = `translate(${clamp(
            hovered.x + 14,
            8,
            Math.max(8, width - tipShown.w - 8),
          )}px, ${clamp(
            hovered.y - tipShown.h / 2,
            8,
            Math.max(8, height - tipShown.h - 8),
          )}px)`;
          if (!draggingRef.current) canvas.style.cursor = "pointer";
        }
      }

      // Marcador de la región seleccionada.
      const marker = project(
        locationDot.cosPhi,
        locationDot.sinPhi,
        locationDot.lonRad,
        cx,
        cy,
        radius,
        rotation,
        cosTilt,
        sinTilt,
      );

      if (marker.z > 0.05) {
        const pulse = 0.55 + 0.45 * Math.sin(now * 0.0032);
        const markerAlpha = 0.35 + marker.z * 0.55;

        context.save();
        context.strokeStyle = `rgba(165, 243, 252, ${markerAlpha.toFixed(3)})`;
        context.lineWidth = 1.1;
        context.beginPath();
        context.arc(marker.x, marker.y, 7.5 + pulse * 2.5, 0, TAU);
        context.stroke();

        context.strokeStyle = `rgba(34, 211, 238, ${(markerAlpha * 0.65).toFixed(3)})`;
        context.beginPath();
        context.arc(marker.x, marker.y, 13 + pulse * 3, 0, TAU);
        context.stroke();

        context.fillStyle = "#ecfeff";
        context.beginPath();
        context.arc(marker.x, marker.y, 2.1, 0, TAU);
        context.fill();

        context.strokeStyle = "rgba(207, 250, 254, 0.8)";
        context.lineWidth = 0.9;
        context.beginPath();
        context.moveTo(marker.x - 11, marker.y);
        context.lineTo(marker.x - 5, marker.y);
        context.moveTo(marker.x + 5, marker.y);
        context.lineTo(marker.x + 11, marker.y);
        context.moveTo(marker.x, marker.y - 11);
        context.lineTo(marker.x, marker.y - 5);
        context.moveTo(marker.x, marker.y + 5);
        context.lineTo(marker.x, marker.y + 11);
        context.stroke();

        const label = location.name.toUpperCase();
        context.font =
          "600 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
        const textWidth = context.measureText(label).width;
        let labelX = marker.x + 18;
        const labelY = marker.y - 30;

        if (labelX + textWidth + 16 > cx + radius) {
          labelX = marker.x - textWidth - 18;
        }

        context.strokeStyle = "rgba(103, 232, 249, 0.35)";
        context.lineWidth = 0.7;
        context.beginPath();
        context.moveTo(marker.x, marker.y - 12);
        context.lineTo(labelX, labelY + 8);
        context.stroke();

        context.fillStyle = "rgba(2, 6, 23, 0.72)";
        context.strokeStyle = "rgba(103, 232, 249, 0.35)";
        context.lineWidth = 0.8;
        context.beginPath();
        context.roundRect(labelX - 6, labelY - 3, textWidth + 12, 18, 3);
        context.fill();
        context.stroke();

        context.fillStyle = "rgba(207, 250, 254, 0.92)";
        context.fillText(label, labelX, labelY + 9);
        context.restore();
      }

      // Barrido radar durante la consulta a FIRMS.
      if (generating) {
        context.save();
        context.beginPath();
        context.arc(cx, cy, radius, 0, TAU);
        context.clip();

        const scanProgress = (now * 0.00055) % 1;
        const scanY = cy - radius + scanProgress * radius * 2;
        const scanGradient = context.createLinearGradient(
          0,
          scanY - 16,
          0,
          scanY + 16,
        );
        scanGradient.addColorStop(0, "rgba(34, 211, 238, 0)");
        scanGradient.addColorStop(0.5, "rgba(34, 211, 238, 0.22)");
        scanGradient.addColorStop(1, "rgba(34, 211, 238, 0)");
        context.fillStyle = scanGradient;
        context.fillRect(cx - radius, scanY - 16, radius * 2, 32);

        context.strokeStyle = "rgba(165, 243, 252, 0.5)";
        context.lineWidth = 0.7;
        context.beginPath();
        context.moveTo(cx - radius, scanY);
        context.lineTo(cx + radius, scanY);
        context.stroke();

        const ringPhase = (now % 2400) / 2400;
        context.strokeStyle = `rgba(34, 211, 238, ${(
          0.25 * (1 - ringPhase)
        ).toFixed(3)})`;
        context.lineWidth = 1.2;
        context.beginPath();
        context.arc(cx, cy, radius * ringPhase, 0, TAU);
        context.stroke();
        context.restore();
      }

      // Crosshair HUD alrededor del globo.
      context.save();
      context.strokeStyle = "rgba(125, 211, 252, 0.18)";
      context.lineWidth = 0.8;
      const bracket = radius * 1.18;
      const arm = radius * 0.07;
      for (const [dx, dy] of [
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ] as const) {
        const x = cx + dx * bracket;
        const y = cy + dy * bracket;
        context.beginPath();
        context.moveTo(x, y - dy * arm);
        context.lineTo(x, y);
        context.lineTo(x - dx * arm, y);
        context.stroke();
      }
      context.restore();

      frame = window.requestAnimationFrame(draw);
    };

    // Interacción: arrastrar para rotar.
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      draggingRef.current = true;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      resumeAtRef.current = performance.now() + 3200;
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
      mouse.inside = true;
      if (!draggingRef.current) return;
      const deltaX = event.clientX - pointerRef.current.x;
      const deltaY = event.clientY - pointerRef.current.y;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      rotationRef.current += deltaX * 0.0055;
      tiltRef.current = clamp(tiltRef.current + deltaY * 0.004, -0.78, 0.52);
      resumeAtRef.current = performance.now() + 3200;
    };

    const onPointerUp = (event: PointerEvent) => {
      draggingRef.current = false;
      resumeAtRef.current = performance.now() + 1800;
      canvas.style.cursor = "grab";
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    const onPointerLeave = () => {
      mouse.inside = false;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        rotationRef.current += event.key === "ArrowLeft" ? -0.09 : 0.09;
        resumeAtRef.current = performance.now() + 3200;
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("keydown", onKeyDown);
    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("keydown", onKeyDown);
    };
  }, [firePoints, generating, location, showFires]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      <canvas
        ref={canvasRef}
        role="img"
        tabIndex={0}
        aria-label={`Interactive globe centered on ${location.name}. Use the left and right arrow keys to rotate it.`}
        className="h-full w-full cursor-grab touch-none outline-none focus-visible:ring-1 focus-visible:ring-cyan-400/40"
      />

      <div
        ref={tooltipRef}
        className="pointer-events-none absolute left-0 top-0 z-30 opacity-0 transition-opacity duration-100"
      >
        <div className="rounded-lg border border-cyan-400/25 bg-slate-950/85 px-2.5 py-1.5 shadow-xl shadow-black/50 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-amber-200">
            <Flame className="h-2.5 w-2.5" />
            <span ref={tipFrpRef}>—</span>
          </div>
          <div
            ref={tipSensorsRef}
            className="mt-0.5 font-mono text-[8px] tracking-[0.06em] text-slate-400"
          >
            —
          </div>
          <div
            ref={tipAgreementRef}
            className="mt-0.5 hidden font-mono text-[7px] uppercase tracking-[0.12em] text-cyan-300/90"
          >
            MODIS + VIIRS agreement
          </div>
        </div>
      </div>
    </div>
  );
}
