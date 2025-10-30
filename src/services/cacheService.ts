// src/services/cacheService.ts
interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number; // Time to live in milliseconds
}

class CacheService {
	private cache = new Map<string, CacheEntry<any>>();
	private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

	set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
			ttl
		});
	}

	get<T>(key: string): T | null {
		const entry = this.cache.get(key);
		if (!entry) return null;

		const isExpired = Date.now() - entry.timestamp > entry.ttl;
		if (isExpired) {
			this.cache.delete(key);
			return null;
		}

		return entry.data;
	}

	has(key: string): boolean {
		const entry = this.cache.get(key);
		if (!entry) return false;

		const isExpired = Date.now() - entry.timestamp > entry.ttl;
		if (isExpired) {
			this.cache.delete(key);
			return false;
		}

		return true;
	}

	delete(key: string): void {
		this.cache.delete(key);
	}

	clear(): void {
		this.cache.clear();
	}

	// Generate cache key for API requests
	generateKey(endpoint: string, params: Record<string, any> = {}): string {
		const sortedParams = Object.keys(params)
			.sort()
			.map(key => `${key}=${params[key]}`)
			.join('&');
		return `${endpoint}${sortedParams ? `?${sortedParams}` : ''}`;
	}
}

export const cacheService = new CacheService();

// Enhanced fetch with caching
export async function cachedFetch<T>(
	url: string, 
	options: RequestInit = {}, 
	ttl: number = 5 * 60 * 1000
): Promise<T> {
	const cacheKey = cacheService.generateKey(url, options);
	
	// Try to get from cache first
	const cached = cacheService.get<T>(cacheKey);
	if (cached) {
		console.log(`[Cache] Hit for ${url}`);
		return cached;
	}

	console.log(`[Cache] Miss for ${url}, fetching...`);
	
	try {
		const response = await fetch(url, {
			...options,
			headers: {
				'Content-Type': 'application/json',
				...options.headers,
			},
		});

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		const data = await response.json();
		
		// Cache the result
		cacheService.set(cacheKey, data, ttl);
		
		return data;
	} catch (error) {
		console.error(`[Cache] Error fetching ${url}:`, error);
		throw error;
	}
}
