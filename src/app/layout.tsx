import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ibarra Instruments | Registro y Pixel Runner",
  description: "Registro de instrumentos y juego de plataformas Pixel Runner.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}