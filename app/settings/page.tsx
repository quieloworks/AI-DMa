import { Shell } from "@/components/Shell";
import { getSetting } from "@/lib/db";
import { ensureModelsAvailable } from "@/server/ollama";
import { checkSystemTts } from "@/server/system-tts";
import { handbookStats } from "@/server/rag";
import { getProvidersConfig, listConfiguredKeys } from "@/server/providers/config";
import { CHAT_CATALOG, IMAGE_CATALOG, OPENAI_TTS_VOICES, VOICE_CATALOG } from "@/server/providers/catalog";
import { SettingsForm } from "./form";
import { ProvidersPanel } from "./providers";

export const dynamic = "force-dynamic";

type GlobalSettings = {
  diceDm: "auto" | "manual";
  diceDefault: "auto" | "manual";
  voice: string;
  sfx: boolean;
  defaultMode: "auto" | "assistant";
};

const DEFAULTS: GlobalSettings = {
  diceDm: "auto",
  diceDefault: "auto",
  voice: "Paulina",
  sfx: true,
  defaultMode: "auto",
};

export default async function SettingsPage() {
  const s = getSetting<GlobalSettings>("global", DEFAULTS);
  const models = await ensureModelsAvailable();
  const systemTts = await checkSystemTts();
  const hb = handbookStats();
  const providersInitial = {
    config: getProvidersConfig(),
    keys: listConfiguredKeys(),
    catalog: {
      chat: CHAT_CATALOG,
      image: IMAGE_CATALOG,
      voice: VOICE_CATALOG,
      openaiVoices: OPENAI_TTS_VOICES,
    },
  };

  return (
    <Shell active="settings">
      <div className="mb-8">
        <span className="badge mb-3">Ajustes</span>
        <h1>Configura tu mesa.</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4">Modelos locales</h2>
          <ul className="space-y-2 text-sm">
            <Row label="Ollama" ok={models.installed.length > 0} detail={`${models.installed.length} modelos instalados`} />
            <Row label="Modelo de chat (gemma4)" ok={models.chat} detail={models.chat ? "OK" : "no encontrado — corre `ollama pull gemma4:e2b`"} />
            <Row label="Modelo de embeddings" ok={models.embed} detail={models.embed ? "OK" : "corre `ollama pull nomic-embed-text`"} />
            <Row
              label="TTS local (sistema)"
              ok={systemTts.ok}
              detail={
                systemTts.ok
                  ? `${systemTts.engine ?? "?"} · voz por defecto: ${systemTts.voice}`
                  : (systemTts.detail ?? "no disponible")
              }
            />
          </ul>
        </section>

        <section className="card">
          <h2 className="mb-4">Manual del jugador (RAG)</h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {hb.total === 0 ? "Aún no se ha ingestado el Handbook." : `${hb.total} chunks indexados · ${hb.vecCount} con embeddings.`}
          </p>
          <div className="mt-3 space-y-1 text-xs">
            {hb.bySection.map((s) => (
              <div key={s.section} className="flex justify-between" style={{ color: "var(--color-text-hint)" }}>
                <span>{s.section}</span>
                <span>{s.c}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs" style={{ color: "var(--color-text-hint)" }}>
            Corre <code className="rounded bg-black/30 px-1 py-0.5 font-mono">npm run ingest:handbook</code> para (re)indexar.
          </p>
        </section>

        <section className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2>Proveedores de IA</h2>
            <span className="text-xs" style={{ color: "var(--color-text-hint)" }}>
              chat · imagen · voz
            </span>
          </div>
          <ProvidersPanel initial={providersInitial} />
        </section>

        <section className="card lg:col-span-2">
          <h2 className="mb-4">Preferencias de mesa</h2>
          <SettingsForm initial={s} />
        </section>
      </div>
    </Shell>
  );
}

function Row({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <li className="flex items-center justify-between">
      <span>
        <span className="mr-2" style={{ color: ok ? "var(--color-accent)" : "var(--color-text-hint)" }}>
          {ok ? "●" : "○"}
        </span>
        {label}
      </span>
      <span className="text-xs" style={{ color: "var(--color-text-hint)" }}>{detail}</span>
    </li>
  );
}
