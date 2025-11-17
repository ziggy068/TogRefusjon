import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Tog Refusjon",
  description: "Automatisk refusjonsapp for togreiser",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#005FC9", // Oslo Bysykkel blue (primary-500)
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="no">
      <body className="antialiased">
        <Navigation />
        {children}
      </body>
    </html>
  );
}
