/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The dashboard reconstructs live on-chain state from the public testnet
  // explorer API and hosts the real x402 paywall as API routes — fully
  // standalone on Vercel (the committed snapshot is only a fallback).
  // casper-js-sdk is a CJS webpack bundle; keep it external so Node loads it
  // at runtime instead of the bundler re-processing it.
  serverExternalPackages: ["casper-js-sdk"],
};

export default nextConfig;
