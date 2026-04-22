import type { Metadata } from "next";
import "./globals.css";
import { LocaleProvider } from "@/components/LocaleProvider";
import { getGlobalSettings } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/t";

export async function generateMetadata(): Promise<Metadata> {
  const locale = getGlobalSettings().locale;
  return {
    title: t(locale, "meta.title"),
    description: t(locale, "meta.description"),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getGlobalSettings().locale;
  return (
    <html lang={locale}>
      <body className="min-h-screen antialiased">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
