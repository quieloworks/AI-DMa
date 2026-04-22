import { Shell } from "@/components/Shell";
import { getSetting } from "@/lib/db";
import { GLOBAL_SETTINGS_DEFAULTS, mergeGlobalSettings, type GlobalSettings } from "@/lib/i18n/global-settings";
import { serverT } from "@/lib/i18n/server";
import { ensureModelsAvailable } from "@/server/ollama";
import { checkSystemTts } from "@/server/system-tts";
import { handbookStats } from "@/server/rag";
import { getProvidersConfig, listConfiguredKeys } from "@/server/providers/config";
import { CHAT_CATALOG, IMAGE_CATALOG, OPENAI_TTS_VOICES, VOICE_CATALOG } from "@/server/providers/catalog";
import { SettingsForm } from "./form";
import { ProvidersPanel } from "./providers";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = mergeGlobalSettings(getSetting<Partial<GlobalSettings>>("global", GLOBAL_SETTINGS_DEFAULTS));
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
        <span className="badge mb-3">{serverT("settings.title")}</span>
        <h1>{serverT("settings.h1")}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4">{serverT("settings.localModels")}</h2>
          <ul className="space-y-2 text-sm">
            <Row label={serverT("settings.row.ollama")} ok={models.installed.length > 0} detail={serverT("settings.modelsInstalled", { n: models.installed.length })} />
            <Row label={serverT("settings.row.chatModel")} ok={models.chat} detail={models.chat ? serverT("settings.ok") : serverT("settings.pullGemma")} />
            <Row label={serverT("settings.row.embedModel")} ok={models.embed} detail={models.embed ? serverT("settings.ok") : serverT("settings.pullEmbed")} />
            <Row
              label={serverT("settings.row.systemTts")}
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
          <h2 className="mb-4">{serverT("settings.handbook")}</h2>
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {hb.total === 0 ? serverT("settings.handbookNone") : serverT("settings.handbookChunks", { total: hb.total, vec: hb.vecCount })}
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
            {serverT("settings.ingestPara")}{" "}
            <code className="rounded bg-black/30 px-1 py-0.5 font-mono">{serverT("settings.ingestCmd")}</code>{" "}
            {serverT("settings.ingestHint")}
          </p>
          <p className="mt-2 text-xs" style={{ color: "var(--color-text-hint)" }}>
            {serverT("settings.ragNote")}
          </p>
        </section>

        <section className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2>{serverT("settings.providersTitle")}</h2>
            <span className="text-xs" style={{ color: "var(--color-text-hint)" }}>
              {serverT("settings.providersSubtitle")}
            </span>
          </div>
          <ProvidersPanel initial={providersInitial} />
        </section>

        <section className="card lg:col-span-2">
          <h2 className="mb-4">{serverT("settings.prefs")}</h2>
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
