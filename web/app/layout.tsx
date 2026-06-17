import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "verity — reputation-staked signal oracle",
  description:
    "A reputation-staked x402 signal oracle and an autonomous DeFi agent that trusts it only as far as its on-chain track record. Casper testnet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
