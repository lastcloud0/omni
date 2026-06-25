import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "O.M.N.I.",
  description: "Omnipresent Networked Machine Intelligence",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="dark">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
