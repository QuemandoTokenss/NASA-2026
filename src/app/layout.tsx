import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { DataProvider } from "@/lib/data/DataProvider";
import { I18nProvider, LocaleKeyed } from "@/lib/I18nProvider";
import { SelectionProvider } from "@/lib/state/SelectionProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SITE REGRET · Lunar Landing Site Navigator", template: "%s · SITE REGRET" },
  description:
    "Comparador de dos sitios del polo sur lunar (Connecting Ridge ROI 4 y ROI 6) con resultados científicos precalculados y trazables. NASA Space Apps Challenge 2026 · QuemandoTokens.",
};

export const viewport: Viewport = {
  themeColor: "#050912",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <I18nProvider>
          <DataProvider>
            <SelectionProvider>
              <LocaleKeyed>
                <AppShell>{children}</AppShell>
              </LocaleKeyed>
            </SelectionProvider>
          </DataProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
