"use client";

import { useEffect, useRef } from "react";

type Player = {
  playerId: string;
  character: { name: string } | null;
};

const PALETTE: Record<string, { grid: string; bg: string; label: string }> = {
  bosque: { grid: "#6b8e4e", bg: "#1e2a17", label: "Bosque" },
  mazmorra: { grid: "#7a7164", bg: "#1a1512", label: "Mazmorra" },
  taberna: { grid: "#a06a36", bg: "#241810", label: "Taberna" },
  camino: { grid: "#8b7e68", bg: "#1f1b14", label: "Camino" },
  ciudad: { grid: "#9a9ba5", bg: "#151720", label: "Ciudad" },
  ninguno: { grid: "#7d6e59", bg: "#181511", label: "Escena" },
};

export function MapCanvas({ hint, players }: { hint: string; players: Player[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio ?? 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const palette = PALETTE[hint] ?? PALETTE.ninguno;
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, rect.width, rect.height);

    const cell = 40;
    ctx.strokeStyle = palette.grid;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < rect.width; x += cell) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, rect.height);
      ctx.stroke();
    }
    for (let y = 0; y < rect.height; y += cell) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(rect.width, y + 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#d85a30";
    ctx.strokeStyle = "#f4a582";
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    players.forEach((p, i) => {
      const angle = (i / Math.max(1, players.length)) * Math.PI * 2;
      const x = cx + Math.cos(angle) * 80;
      const y = cy + Math.sin(angle) * 80;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#faf7f1";
      ctx.font = "11px 'Cabinet Grotesk', sans-serif";
      ctx.textAlign = "center";
      const name = (p.character?.name ?? "").slice(0, 8);
      ctx.fillText(name, x, y + 28);
      ctx.fillStyle = "#d85a30";
    });

    ctx.fillStyle = "rgba(244,239,230,0.4)";
    ctx.font = "italic 12px 'Instrument Serif', serif";
    ctx.textAlign = "left";
    ctx.fillText(palette.label, 16, 22);
  }, [hint, players]);

  return <canvas ref={canvasRef} className="h-full w-full" style={{ display: "block", minHeight: 420 }} />;
}
