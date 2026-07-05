import type { Metadata } from "next";
import "./globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
