/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  // Discloud site hosting requires port 8080 bound to 0.0.0.0
  ...(process.env.DISCLOUD_SITE === 'true' && {
    server: { port: 8080, hostname: '0.0.0.0' },
  }),
};

module.exports = nextConfig;
