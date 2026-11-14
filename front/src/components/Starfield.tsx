"use client";

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
  phase: number;
  color: string;
  bright: boolean;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export default function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let meteor: Meteor | null = null;
    let nextMeteorAt = performance.now() + 5000;
    let frame = 0;
    let lastFrame = performance.now();

    const buildStars = () => {
      const random = seededRandom(20260419);
      const count = Math.max(
        90,
        Math.min(340, Math.round((width * height) / 6200)),
      );

      stars = Array.from({ length: count }, () => {
        const colorRoll = random();
        const color =
          colorRoll > 0.9
            ? "rgba(251, 191, 36, ALPHA)"
            : colorRoll > 0.72
              ? "rgba(165, 243, 252, ALPHA)"
              : "rgba(226, 232, 240, ALPHA)";

        return {
          x: random() * width,
          y: random() * height,
          radius: 0.35 + random() * 1.15,
          alpha: 0.15 + random() * 0.7,
          speed: 0.25 + random() * 1.1,
          phase: random() * Math.PI * 2,
          color,
          bright: random() > 0.955,
        };
      });
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      buildStars();
      drawStatic();
    };

    const drawStatic = () => {
      context.clearRect(0, 0, width, height);

      for (const star of stars) {
        context.beginPath();
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fillStyle = star.color.replace("ALPHA", star.alpha.toFixed(3));
        context.fill();
      }
    };

    const drawStar = (star: Star, now: number) => {
      const twinkle =
        0.55 + 0.45 * Math.sin(now * 0.001 * star.speed + star.phase);
      const alpha = Math.min(1, star.alpha * twinkle);

      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fillStyle = star.color.replace("ALPHA", alpha.toFixed(3));

      if (star.bright) {
        context.shadowBlur = 10;
        context.shadowColor = "rgba(186, 230, 253, 0.7)";
      }

      context.fill();
      context.shadowBlur = 0;

      if (star.bright) {
        context.strokeStyle = `rgba(226, 232, 240, ${(alpha * 0.35).toFixed(3)})`;
        context.lineWidth = 0.6;
        context.beginPath();
        context.moveTo(star.x - star.radius * 3.2, star.y);
        context.lineTo(star.x + star.radius * 3.2, star.y);
        context.moveTo(star.x, star.y - star.radius * 3.2);
        context.lineTo(star.x, star.y + star.radius * 3.2);
        context.stroke();
      }
    };

    const drawMeteor = () => {
      if (!meteor) return;

      const gradient = context.createLinearGradient(
        meteor.x,
        meteor.y,
        meteor.x - meteor.vx * 90,
        meteor.y - meteor.vy * 90,
      );
      gradient.addColorStop(0, "rgba(240, 249, 255, 0.95)");
      gradient.addColorStop(0.25, "rgba(125, 211, 252, 0.5)");
      gradient.addColorStop(1, "rgba(125, 211, 252, 0)");

      context.save();
      context.strokeStyle = gradient;
      context.lineWidth = 1.4;
      context.lineCap = "round";
      context.beginPath();
      context.moveTo(meteor.x, meteor.y);
      context.lineTo(meteor.x - meteor.vx * 90, meteor.y - meteor.vy * 90);
      context.stroke();
      context.restore();
    };

    const frameLoop = (now: number) => {
      const delta = Math.min(64, now - lastFrame);
      lastFrame = now;

      context.clearRect(0, 0, width, height);
      for (const star of stars) drawStar(star, now);

      if (now > nextMeteorAt) {
        const startX = width * (0.15 + Math.random() * 0.7);
        const startY = height * (0.05 + Math.random() * 0.35);
        const angle = Math.PI * (0.18 + Math.random() * 0.18);
        const speed = 0.35 + Math.random() * 0.3;
        meteor = {
          x: startX,
          y: startY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0,
          maxLife: 1400 + Math.random() * 700,
        };
        nextMeteorAt = now + 7000 + Math.random() * 9000;
      }

      if (meteor) {
        meteor.life += delta;
        meteor.x += meteor.vx * delta;
        meteor.y += meteor.vy * delta;
        drawMeteor();
        if (
          meteor.life > meteor.maxLife ||
          meteor.x > width + 150 ||
          meteor.y > height + 150
        ) {
          meteor = null;
        }
      }

      frame = window.requestAnimationFrame(frameLoop);
    };

    resize();

    if (!reducedMotion) {
      frame = window.requestAnimationFrame(frameLoop);
    }

    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
    />
  );
}
