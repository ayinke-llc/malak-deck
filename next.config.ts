import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    
    return config;
  },
  images: {
   
  },
};

export default nextConfig;
