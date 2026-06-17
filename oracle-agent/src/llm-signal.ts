/**
 * LLM signal generation via the DeepSeek API (OpenAI-compatible chat completions).
 * Feeds a real market snapshot to the model and parses a strict-JSON directional
 * signal (direction, calibrated confidence, reasoning). Prompt templates live in
 * /prompts/signal-generation.md (kept in sync here).
 *
 * Uses plain fetch against `${baseUrl}/chat/completions` — no SDK dependency.
 */
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

interface ChatCompletion {
  choices?: { message?: { content?: string } }[];
}

export async function generateSignal(opts: {
  apiKey: string;
  model: string;
  baseUrl: string;
  snapshot: MarketSnapshot;
  horizonHours: number;
}): Promise<GeneratedSignal> {
  const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: 600,
      temperature: 0.7,
      // DeepSeek/OpenAI JSON mode — the prompt already mandates STRICT JSON.
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(opts.snapshot, opts.horizonHours) },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`DeepSeek API ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as ChatCompletion;
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek returned no message content");
  }

  const parsed = SignalSchema.parse(extractJson(content));
  return {
    direction: directionFromLabel(parsed.direction),
    confidence: parsed.confidence,
    horizonHours: parsed.horizon_hours,
    reasoning: parsed.reasoning,
    keyFactors: parsed.key_factors,
  };
}
