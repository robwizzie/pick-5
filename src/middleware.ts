// src/middleware.ts
export { default } from 'next-auth/middleware';
export const config = {
	// Invite links (/league/join/<code>) stay public so logged-out friends see the
	// invitation and link previews can read its title; the page handles sign-in.
	matcher: ['/api/picks/:path*', '/dashboard/:path*', '/league/((?!join/).+)']
};
