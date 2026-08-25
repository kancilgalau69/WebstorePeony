import type { Metadata } from "next";
import "./globals.css";
import "driver.js/dist/driver.css";

export const metadata: Metadata = {
  title: "Dashboard Reseller - Rain Store",
  description: "Panel dashboard untuk reseller Rain Store",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="antialiased bg-[#f6f7fb]">
        {children}
      </body>
    </html>
  );
}
