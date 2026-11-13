import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Лінивець — генератор AVK-5",
  description: "Підготуйте документ AVK-5 з кошторису за кілька кроків.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "64x64" }],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{`(() => {
  try {
    const saved = localStorage.getItem("linyvets-theme");
    const theme = saved === "light" || saved === "dark"
      ? saved
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch {}
})();`}</Script>
      </head>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
