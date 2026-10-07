// League feed shared types and limits (pure: safe on client and server).

export const FEED_REACTIONS = ['🔥', '😂', '💀', '👏', '🧊', '🗑️'] as const;
export type FeedReaction = (typeof FEED_REACTIONS)[number];
export const FEED_MESSAGE_MAX = 280;
export const FEED_PAGE_SIZE = 40;

export interface FeedMessage {
	id: string;
	kind: 'chat' | 'moment';
	userId: string | null;
	name: string | null;
	image: string | null;
	text: string;
	emoji: string | null;
	week: number | null;
	createdAt: string;
	/** emoji -> count */
	reactions: Record<string, number>;
	/** Reactions the viewer has added */
	mine: string[];
}

/** GET /api/league/[id]/feed */
export interface FeedResponse {
	messages: FeedMessage[];
	hasMore: boolean;
}
