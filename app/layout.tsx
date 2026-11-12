import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
