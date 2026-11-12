import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Лінивець — генератор AVK-5",
  description: "Підготуйте документ AVK-5 з кошторису за кілька кроків.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
