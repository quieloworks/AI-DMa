"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/components/LocaleProvider";

type CharacterOpt = { id: string; name: string; class: string | null; race: string | null; level: number };

export function NewStoryForm({ characters }: { characters: CharacterOpt[] }) {
  const router = useRouter();
  const tr = useTranslations();
  const [title, setTitle] = useState("");
  const [seed, setSeed] = useState("");
  const [mode, setMode] = useState<"auto" | "assistant">("auto");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function submit() {
    if (!title || picked.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      let res: Response;
      if (pdf) {
        const fd = new FormData();
        fd.set("title", title);
        fd.set("mode", mode);
        fd.set("seed", seed);
        fd.set("playerCharacterIds", JSON.stringify(picked));
        fd.set("adventurePdf", pdf);
        res = await fetch("/api/story", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, mode, seed, playerCharacterIds: picked }),
        });
      }
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? tr("storyNew.form.errorHttp", { status: res.status }));
      }
      const data = (await res.json()) as { sessionId: string };
      router.push(`/story/${data.sessionId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  function onPickFile(file: File | null) {
    if (!file) {
      setPdf(null);
      return;
    }
    if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError(tr("storyNew.form.errorMustBePdf"));
      return;
    }
    if (file.size > 40 * 1024 * 1024) {
      setError(tr("storyNew.form.errorPdfTooBig"));
      return;
    }
    setError(null);
    setPdf(file);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="card space-y-4">
        <label className="block">
          <span className="label">{tr("common.title")}</span>
          <input
            className="input mt-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tr("storyNew.form.titlePlaceholder")}
          />
        </label>

        <div>
          <span className="label">{tr("storyNew.form.dmModeLabel")}</span>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setMode("auto")}
              className={mode === "auto" ? "btn-accent" : "btn-ghost"}
            >
              {tr("storyNew.form.modeAuto")}
            </button>
            <button
              type="button"
              onClick={() => setMode("assistant")}
              className={mode === "assistant" ? "btn-accent" : "btn-ghost"}
            >
              {tr("storyNew.form.modeAssistant")}
            </button>
          </div>
        </div>

        <div>
          <span className="label">{tr("storyNew.form.pdfSectionLabel")}</span>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
            {tr("storyNew.form.pdfHelp")}
          </p>
          <div
            className="mt-2 rounded-md px-3 py-3"
            style={{
              border: `0.5px dashed ${pdf ? "var(--color-accent)" : "var(--color-border-strong)"}`,
              background: pdf ? "var(--color-accent-bg)" : "var(--color-bg-tertiary)",
            }}
          >
            {pdf ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{pdf.name}</p>
                  <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
                    {tr("storyNew.form.pdfIngestNote", { mb: (pdf.size / 1024 / 1024).toFixed(2) })}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => {
                    setPdf(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  {tr("storyNew.form.pdfRemove")}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-2">
                <label className="btn-ghost cursor-pointer" style={{ fontSize: 13 }}>
                  📄 {tr("storyNew.form.pdfUpload")}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                <span className="text-xs" style={{ color: "var(--color-text-hint)" }}>
                  {tr("storyNew.form.pdfMaxHint")}
                </span>
              </div>
            )}
          </div>
        </div>

        <label className="block">
          <span className="label">
            {tr("storyNew.form.seedLabel")}{" "}
            {pdf && <span style={{ color: "var(--color-text-hint)" }}>{tr("storyNew.form.seedOptionalHint")}</span>}
          </span>
          <textarea
            className="input mt-2"
            style={{ height: 120, padding: 10 }}
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder={pdf ? tr("storyNew.form.seedPlaceholderPdf") : tr("storyNew.form.seedPlaceholderNoPdf")}
          />
        </label>

        {error && (
          <p
            className="rounded-md px-3 py-2 text-xs"
            style={{ background: "rgba(216,90,48,0.15)", color: "#f4a582" }}
          >
            {error}
          </p>
        )}
      </div>

      <div className="card">
        <p className="label mb-3">{tr("storyNew.form.charactersHeading")}</p>
        {characters.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {tr("storyNew.form.noCharacters")}
          </p>
        ) : (
          <ul className="space-y-2">
            {characters.map((c) => (
              <li key={c.id}>
                <label
                  className="flex items-center justify-between rounded-md px-3 py-2"
                  style={{
                    background: picked.includes(c.id) ? "var(--color-accent-bg)" : "var(--color-bg-tertiary)",
                  }}
                >
                  <div>
                    <p className="text-sm">{c.name}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
                      {c.race ?? "?"} · {c.class ?? "?"} {tr("storyNew.form.levelAbbr", { n: c.level })}
                    </p>
                  </div>
                  <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
                </label>
              </li>
            ))}
          </ul>
        )}

        <button
          disabled={busy || !title || picked.length === 0}
          onClick={submit}
          className="btn-accent mt-6 w-full"
        >
          {busy
            ? pdf
              ? tr("storyNew.form.busyUploading")
              : tr("storyNew.form.busyCreating")
            : pdf
              ? tr("storyNew.form.startWithPdf")
              : tr("storyNew.form.startAdventure")}
        </button>
      </div>
    </div>
  );
}
