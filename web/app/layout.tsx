import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

// Editorial serif for the wordmark/headline, terminal-grade sans+mono for data.
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
});
const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "verity — the trust layer for the machine economy, on Casper",
  description:
    "A reputation-staked x402 signal oracle that bonds real collateral behind every call (wrong calls get slashed) and an autonomous DeFi agent that pays per signal and sizes its trade by that verifiable on-chain reputation. Casper testnet · Agentic Buildathon 2026.",
  openGraph: {
    title: "verity — the trust layer for the machine economy",
    description:
      "Reputation-staked x402 oracle + autonomous DeFi agent on Casper. An oracle's word is worth exactly its slashable, on-chain accuracy.",
    type: "website",
  },
};

export const viewport = { themeColor: "#0b0d0c" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
