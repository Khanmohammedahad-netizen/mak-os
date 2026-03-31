/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    eslint: { ignoreDuringBuilds: true },
    typescript: { ignoreBuildErrors: true },
    // Allow access from any device on LAN
    ...(process.env.NODE_ENV === 'development' && {
        experimental: { serverActions: { allowedOrigins: ['*'] } },
    }),
};

export default nextConfig;
