import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Metadata Chack App",
  description: "Metadata Chack App",
  generator: "Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
