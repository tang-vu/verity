/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The dashboard is self-contained: /api/oracle/* routes serve a committed
  // testnet snapshot, so it runs standalone on Vercel with no backend.
};

export default nextConfig;
