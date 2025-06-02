/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/patient-timeline-dev/**',
      },
    ],
  },
  serverExternalPackages: ['sharp'],
}

module.exports = nextConfig
