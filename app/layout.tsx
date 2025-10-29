import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Token Faucet",
  description: "Get free tokens instantly",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}