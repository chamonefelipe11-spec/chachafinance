import type { Metadata, Viewport } from "next";
// Fontes empacotadas no próprio app (não dependem do Google Fonts no build)
import "@fontsource-variable/geist";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  title: "chachafinance",
  description: "Finanças, faculdade e agenda do Chamone e da Letícia.",
  applicationName: "chachafinance",
  appleWebApp: {
    capable: true,
    title: "chacha",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#15171d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
