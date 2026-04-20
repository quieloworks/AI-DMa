"use client";

import { useEffect, useState } from "react";

type Player = {
  playerId: string;
  token: string;
  character: { name: string } | null;
};

export function QrPanel({ sessionId, players }: { sessionId: string; players: Player[] }) {
  const [url, setUrl] = useState<string>("");
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    fetch(`/api/session/qr/${sessionId}`)
      .then((r) => r.json())
      .then((d: { url: string; dataUrl: string }) => {
        setUrl(d.url);
        setQr(d.dataUrl);
      })
      .catch(() => {});
  }, [sessionId]);

  return (
    <div className="flex flex-col gap-4 rounded-lg p-4 md:flex-row md:items-center" style={{ background: "var(--color-bg-tertiary)", border: "0.5px solid var(--color-border)" }}>
      <div className="flex items-center gap-4">
        {qr ? <img src={qr} alt="QR" className="h-32 w-32 rounded-md" /> : <div className="h-32 w-32 rounded-md" style={{ background: "var(--color-bg-secondary)" }} />}
        <div>
          <p className="label">Invitación por LAN</p>
          <p className="mt-1 text-sm">Cada jugador escanea este código y selecciona su personaje con el enlace que le corresponda.</p>
          <p className="mt-2 font-mono text-xs" style={{ color: "var(--color-accent)" }}>{url || "…"}</p>
        </div>
      </div>
      <div className="flex-1">
        <p className="label mb-2">Enlaces por jugador</p>
        <ul className="space-y-1 text-xs">
          {players.map((p) => (
            <li key={p.playerId} className="flex items-center justify-between gap-2">
              <span style={{ color: "var(--color-text-secondary)" }}>{p.character?.name ?? "—"}</span>
              <code className="truncate font-mono" style={{ color: "var(--color-text-hint)" }}>
                {url ? `${url}?p=${p.playerId}&t=${p.token}` : "…"}
              </code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
