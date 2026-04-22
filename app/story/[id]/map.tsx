"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "@/components/LocaleProvider";

type Player = {
  playerId: string;
  character: { name: string } | null;
};

export type BattleParticipant = {
  id: string;
  name: string;
  kind: "player" | "ally" | "enemy" | "neutral";
  x: number;
  y: number;
  hp?: { current: number; max: number };
  status?: string[];
};

export type BattleMap = {
  terrain?: string;
  grid: { cols: number; rows: number; cellFeet?: number };
  participants: BattleParticipant[];
  obstacles?: Array<{ x: number; y: number; w?: number; h?: number; kind?: string }>;
};

type PaletteTerrainId =
  | "bosque"
  | "mazmorra"
  | "taberna"
  | "camino"
  | "ciudad"
  | "castillo"
  | "subterraneo"
  | "costa"
  | "ninguno";

const PALETTE: Record<PaletteTerrainId, { grid: string; bg: string }> = {
  bosque: { grid: "#6b8e4e", bg: "#1e2a17" },
  mazmorra: { grid: "#7a7164", bg: "#1a1512" },
  taberna: { grid: "#a06a36", bg: "#241810" },
  camino: { grid: "#8b7e68", bg: "#1f1b14" },
  ciudad: { grid: "#9a9ba5", bg: "#151720" },
  castillo: { grid: "#96877a", bg: "#181411" },
  subterraneo: { grid: "#6f6a5c", bg: "#12100d" },
  costa: { grid: "#7ca8bf", bg: "#0f1a22" },
  ninguno: { grid: "#7d6e59", bg: "#181511" },
};

const KIND_COLORS: Record<BattleParticipant["kind"], { fill: string; stroke: string; ring: string }> = {
  player: { fill: "#378add", stroke: "#9dc5ee", ring: "rgba(55,138,221,0.25)" },
  ally: { fill: "#63c07b", stroke: "#aee0ba", ring: "rgba(99,192,123,0.25)" },
  enemy: { fill: "#d85a30", stroke: "#f4a582", ring: "rgba(216,90,48,0.25)" },
  neutral: { fill: "#cfa33a", stroke: "#eed58c", ring: "rgba(207,163,58,0.25)" },
};

const OBSTACLE_COLORS: Record<string, { fill: string; stroke: string }> = {
  wall: { fill: "#3d3832", stroke: "#6a6257" },
  rock: { fill: "#4a473f", stroke: "#7a766a" },
  tree: { fill: "#22361c", stroke: "#4b7a3c" },
  water: { fill: "#1b3648", stroke: "#2f688a" },
  door: { fill: "#5a3a1f", stroke: "#a06a36" },
  fire: { fill: "#6a2a10", stroke: "#ef8a3a" },
  cover: { fill: "#3b3a34", stroke: "#7a7463" },
  table: { fill: "#4a3623", stroke: "#855d3b" },
  pillar: { fill: "#53504a", stroke: "#8a867c" },
};

function resolvePalette(hint: string | undefined) {
  const id = (hint && hint in PALETTE ? hint : "ninguno") as PaletteTerrainId;
  return PALETTE[id] ?? PALETTE.ninguno;
}

function terrainId(hint: string | undefined): PaletteTerrainId {
  return (hint && hint in PALETTE ? hint : "ninguno") as PaletteTerrainId;
}

function setupCanvas(canvas: HTMLCanvasElement): { ctx: CanvasRenderingContext2D; w: number; h: number } | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio ?? 1;
  canvas.width = Math.max(1, rect.width * dpr);
  canvas.height = Math.max(1, rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w: rect.width, h: rect.height };
}

export function MapCanvas({ hint, players }: { hint: string; players: Player[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tr = useTranslations();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;

    const palette = resolvePalette(hint);
    const terrainName = tr(`battleMap.palette.${terrainId(hint)}`);
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, w, h);

    const cell = 40;
    ctx.strokeStyle = palette.grid;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < w; x += cell) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += cell) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#d85a30";
    ctx.strokeStyle = "#f4a582";
    const cx = w / 2;
    const cy = h / 2;
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
    ctx.fillText(terrainName, 16, 22);
  }, [hint, players, tr]);

  return <canvas ref={canvasRef} className="h-full w-full" style={{ display: "block", minHeight: 420 }} />;
}

export function BattleMapCanvas({
  battleMap,
  turn,
}: {
  battleMap: BattleMap;
  turn?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tr = useTranslations();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setup = setupCanvas(canvas);
    if (!setup) return;
    const { ctx, w, h } = setup;

    const palette = resolvePalette(battleMap.terrain);
    const terrainName = tr(`battleMap.palette.${terrainId(battleMap.terrain)}`);
    const cols = Math.max(4, battleMap.grid.cols);
    const rows = Math.max(4, battleMap.grid.rows);
    const cellFeet = battleMap.grid.cellFeet ?? 5;

    const pad = 20;
    const available = { w: w - pad * 2, h: h - pad * 2 };
    const cellSize = Math.max(10, Math.min(available.w / cols, available.h / rows));
    const gridW = cellSize * cols;
    const gridH = cellSize * rows;
    const ox = pad + (available.w - gridW) / 2;
    const oy = pad + (available.h - gridH) / 2;

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, palette.bg);
    bgGrad.addColorStop(1, "#0d0c0a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "rgba(255,255,255,0.02)";
    ctx.fillRect(ox, oy, gridW, gridH);

    ctx.strokeStyle = palette.grid;
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= cols; c++) {
      const x = ox + c * cellSize;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, oy);
      ctx.lineTo(x + 0.5, oy + gridH);
      ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
      const y = oy + r * cellSize;
      ctx.beginPath();
      ctx.moveTo(ox, y + 0.5);
      ctx.lineTo(ox + gridW, y + 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const ob of battleMap.obstacles ?? []) {
      const colors = OBSTACLE_COLORS[ob.kind ?? "cover"] ?? OBSTACLE_COLORS.cover;
      const x = ox + ob.x * cellSize;
      const y = oy + ob.y * cellSize;
      const width = (ob.w ?? 1) * cellSize;
      const height = (ob.h ?? 1) * cellSize;
      ctx.fillStyle = colors.fill;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
      if (ob.kind === "fire") {
        ctx.fillStyle = "rgba(239,138,58,0.35)";
        ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
      }
    }

    for (const p of battleMap.participants) {
      const colors = KIND_COLORS[p.kind] ?? KIND_COLORS.neutral;
      const cx = ox + p.x * cellSize + cellSize / 2;
      const cy = oy + p.y * cellSize + cellSize / 2;
      const radius = Math.max(8, cellSize * 0.38);

      ctx.fillStyle = colors.ring;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = colors.fill;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      const initial = (p.name || p.id || "?").trim().charAt(0).toUpperCase();
      ctx.fillStyle = "#faf7f1";
      ctx.font = `500 ${Math.round(radius)}px 'Cabinet Grotesk', sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initial, cx, cy);

      if (p.hp && p.hp.max > 0) {
        const hpPct = Math.max(0, Math.min(1, p.hp.current / p.hp.max));
        const barW = radius * 1.8;
        const barH = 3;
        const barX = cx - barW / 2;
        const barY = cy + radius + 4;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = hpPct > 0.5 ? "#63c07b" : hpPct > 0.2 ? "#e0a43a" : "#d85a30";
        ctx.fillRect(barX, barY, barW * hpPct, barH);
      }

      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = "#faf7f1";
      ctx.font = "10px 'Cabinet Grotesk', sans-serif";
      const label = (p.name || p.id).slice(0, 10);
      ctx.fillText(label, cx, cy + radius + (p.hp ? 18 : 12));
    }

    ctx.fillStyle = "rgba(244,239,230,0.65)";
    ctx.font = "italic 12px 'Instrument Serif', serif";
    ctx.textAlign = "left";
    ctx.fillText(tr("battleMap.combatBanner", { terrain: terrainName }), 16, 22);
    ctx.fillStyle = "rgba(244,239,230,0.45)";
    ctx.font = "10px 'Cabinet Grotesk', sans-serif";
    const turnPart = turn ? tr("battleMap.turnPart", { n: turn }) : "";
    ctx.fillText(tr("battleMap.gridLine", { cols, rows, feet: cellFeet, turnPart }), 16, 38);

    const legend: Array<{ kind: BattleParticipant["kind"]; label: string }> = [
      { kind: "player", label: tr("battleMap.legend.player") },
      { kind: "ally", label: tr("battleMap.legend.ally") },
      { kind: "enemy", label: tr("battleMap.legend.enemy") },
      { kind: "neutral", label: tr("battleMap.legend.neutral") },
    ];
    const legendY = h - 18;
    let legendX = 16;
    ctx.font = "10px 'Cabinet Grotesk', sans-serif";
    for (const item of legend) {
      const colors = KIND_COLORS[item.kind];
      ctx.fillStyle = colors.fill;
      ctx.beginPath();
      ctx.arc(legendX + 4, legendY - 3, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(244,239,230,0.7)";
      ctx.textAlign = "left";
      ctx.fillText(item.label, legendX + 12, legendY);
      legendX += ctx.measureText(item.label).width + 28;
    }
  }, [battleMap, turn, tr]);

  return <canvas ref={canvasRef} className="h-full w-full" style={{ display: "block", minHeight: 420 }} />;
}
