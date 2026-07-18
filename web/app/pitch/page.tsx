import type { Metadata } from "next";
import { PitchDeck } from "./pitch-deck";
import "./pitch.css";

export const metadata: Metadata = {
  title: "verity — final-round pitch",
  description:
    "3-minute pitch deck for verity: a reputation-staked x402 signal oracle on Casper. Live on-chain numbers, keyboard-driven slides.",
};

export default function PitchPage() {
  return <PitchDeck />;
}
