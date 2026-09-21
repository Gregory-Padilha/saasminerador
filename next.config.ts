import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    '*': ['./web-ui/**'],
  },
};

export default nextConfig;
