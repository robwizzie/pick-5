/** @type {import('next').NextConfig} */
const nextConfig = {
	images: {
		// Serve images as-is (no /_next/image optimizer). Cloudflare Workers has no
		// free built-in Next image optimizer (Cloudflare Images is a paid product),
		// and avatars are already small (Google serves resized lh3 URLs). This also
		// keeps Vercel's image-optimization quota at zero if it is ever deployed there.
		unoptimized: true,
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'lh3.googleusercontent.com'
			}
		]
	}
};

module.exports = nextConfig;
