// OpenNext config for Cloudflare Workers (https://opennext.js.org/cloudflare).
import { defineCloudflareConfig } from '@opennextjs/cloudflare';
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache';

export default defineCloudflareConfig({
	// Read-only cache backed by Workers Static Assets: prerendered pages (landing,
	// login, ...) are served from the build output with no paid bindings (no R2/KV/D1).
	// The app has no ISR; fetch-level `next.revalidate` hints become no-ops here and
	// the in-memory cacheService keeps doing the short-lived caching.
	incrementalCache: staticAssetsIncrementalCache,
	enableCacheInterception: true
});
