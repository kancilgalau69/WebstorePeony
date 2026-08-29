import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Peony Store Dashboard",
  description: "Dashboard untuk mengelola Peony Store",
  manifest: "/manifest.webmanifest",
  themeColor: "#5c63f2",
  appleWebApp: {
    capable: true,
    title: "Peony Store - Dashboard",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#5c63f2" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <script
          dangerouslySetInnerHTML={{
            __html: "if ('serviceWorker' in navigator) { window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js'); }); }",
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
