/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy oracle API calls to the running oracle server (avoids CORS in dev).
  async rewrites() {
    const oracle = process.env.ORACLE_SERVER_URL ?? "http://localhost:4021";
    return [{ source: "/api/oracle/:path*", destination: `${oracle}/:path*` }];
  },
};

export default nextConfig;
