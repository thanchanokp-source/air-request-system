import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.16.161.181"],
  // pdf-parse (+ its pdfjs) reads files at runtime on the server — keep it external so the
  // bundler doesn't try to inline it (avoids build/worker issues).
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
