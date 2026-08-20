import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vitall - Sistema de Ponto",
  description: "Sistema de reconhecimento facial para registro de ponto com alarme de almoço",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Vitall Ponto",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "application-name": "Vitall Ponto",
    "apple-mobile-web-app-title": "Vitall Ponto",
    "theme-color": "#1db9b3",
    "msapplication-navbutton-color": "#1db9b3",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "msapplication-starturl": "/",
    "viewport": "width=device-width, initial-scale=1, shrink-to-fit=no",
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1db9b3',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Vitall Ponto" />
        <script dangerouslySetInnerHTML={{
          __html: `
            // Registrar Service Worker
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(registration) {
                    console.log('✅ SW registrado:', registration.scope);
                  })
                  .catch(function(error) {
                    console.log('❌ Erro no SW:', error);
                  });
              });
            }
          `
        }} />
      </head>
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}
