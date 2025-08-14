import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Production optimizations
  typescript: {
    ignoreBuildErrors: false, // Set to false for production builds
  },
  eslint: {
    ignoreDuringBuilds: false, // Set to false for production builds
  },
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  
  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Experimental features for better performance
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-*',
      'framer-motion',
      'recharts'
    ],
  },
  
  // Development settings (can be overridden for production)
  reactStrictMode: true, // Enable for production builds
  
  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Development-specific webpack config
    if (dev) {
      config.watchOptions = {
        ignored: ['**/*'], // Ignore all file changes for nodemon
      };
    }
    
    // Production optimizations
    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 5,
            },
          },
        },
      };
    }
    
    return config;
  },
  
  // Headers for security
  headers: async () => {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // Redirects and rewrites if needed
  async redirects() {
    return [];
  },
  
  async rewrites() {
    return [];
  },
};

export default nextConfig;
