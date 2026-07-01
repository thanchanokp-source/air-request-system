import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.16.161.181"],
  output: "standalone",
};

export default nextConfig;
