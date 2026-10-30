import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Hide the Next.js dev tools button (it only ever appears in `npm run dev`).
  devIndicators: false,
};

export default nextConfig;
