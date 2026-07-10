/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep PDF extractors out of the Turbopack/webpack bundle so their
  // CJS/worker layout resolves correctly on the server.
  serverExternalPackages: ['unpdf', 'pdf-parse'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'onkklullmgrdqoertngp.supabase.co',
      },
    ],
  },
};

module.exports = nextConfig;
