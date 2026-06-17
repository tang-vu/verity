/**
 * LLM signal generation. Feeds a real market snapshot to Claude and parses a
 * strict-JSON directional signal (direction, calibrated confidence, reasoning).
 * Prompt templates live in /prompts/signal-generation.md (kept in sync here).
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { Direction, directionFromLabel } from "@verity/shared";
import type { MarketSnapshot } from "./market-data.js";

const SignalSchema = z.object({
  direction: z.enum(["UP", "DOWN", "FLAT"]),
  confidence: z.number().int().min(0).max(100),
  horizon_hours: z.number().int().positive(),
  reasoning: z.string().min(1).max(280),
  key_factors: z.array(z.string()).min(1).max(4),
});

export interface GeneratedSignal {
  direction: Direction;
  confidence: number;
  horizonHours: number;
  reasoning: string;
  keyFactors: string[];
}

const SYSTEM_PROMPT = `You are verity-oracle, an autonomous market-signal oracle whose reputation is recorded on the Casper blockchain. Every signal you publish is later RESOLVED against reality, and your on-chain accuracy score rises or falls accordingly. Because your word is only worth your verifiable track record, you are calibrated and honest: you express genuine uncertainty in the confidence field rather than always sounding confident.

You receive a real, timestamped market snapshot. You output a single directional signal for the named asset over the stated horizon.

Output STRICT JSON only, matching exactly:
{
  "direction": "UP" | "DOWN" | "FLAT",
  "confidence": <integer 0-100>,
  "horizon_hours": <integer>,
  "reasoning": "<<= 280 chars, the decisive factors>>",
  "key_factors": ["<short factor>", ...]
}

Rules:
- confidence is a calibrated probability, NOT a conviction level. A coin-flip is 50.
- If the data is thin or conflicting, say so and lower confidence.
- reasoning must be specific to THIS snapshot (cite the numbers), never generic.
- Never output anything but the JSON object.`;

function buildUserPrompt(snapshot: MarketSnapshot, horizonHours: number): string {
  return `Asset: ${snapshot.asset} (${snapshot.symbol}) vs ${snapshot.vsCurrency}
Horizon: ${horizonHours} hours
Snapshot time (UTC): ${new Date(snapshot.timestampMs).toISOString()}

Market snapshot:
- Spot price: ${snapshot.price}
- 24h change: ${snapshot.change24hPct.toFixed(2)}%
- 7d change: ${snapshot.change7dPct.toFixed(2)}%
- 24h volume: ${snapshot.volume24h}
- Market cap: ${snapshot.marketCap}
- 24h high / low: ${snapshot.high24h} / ${snapshot.low24h}

Produce the signal as STRICT JSON.`;
}

/** Extract the first top-level JSON object from a model response. */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`No JSON object in model response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

export async function generateSignal(opts: {
  apiKey: string;
  model: string;
  snapshot: MarketSnapshot;
  horizonHours: number;
}): Promise<GeneratedSignal> {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const response = await client.messages.create({
    model: opts.model,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(opts.snapshot, opts.horizonHours) }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Model returned no text content");
  }

  const parsed = SignalSchema.parse(extractJson(textBlock.text));
  return {
    direction: directionFromLabel(parsed.direction),
    confidence: parsed.confidence,
    horizonHours: parsed.horizon_hours,
    reasoning: parsed.reasoning,
    keyFactors: parsed.key_factors,
  };
}
