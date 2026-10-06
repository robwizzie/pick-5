import type { Metadata } from 'next';

/** Metadata for signed-in pages: a proper tab title, kept out of search results. */
export function privatePage(title: string): Metadata {
	return { title, robots: { index: false, follow: false } };
}
