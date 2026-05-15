/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        // Forward real client IP to the backend on every proxied request.
        // The backend middleware reads X-Forwarded-For and X-Real-IP to
        // recover the true client address for rate limiting and audit logs.
        source: '/api/:path*',
        headers: [
          { key: 'X-Forwarded-For',   value: ':req_ip' },
          { key: 'X-Real-IP',         value: ':req_ip' },
          { key: 'X-Forwarded-Proto', value: 'http' },
          { key: 'X-Forwarded-Host',  value: ':req_host' },
        ],
      },
    ];
  },
};

export default nextConfig;
