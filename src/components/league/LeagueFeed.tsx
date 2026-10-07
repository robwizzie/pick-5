'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { Loader2, MessageCircle, SendHorizontal, SmilePlus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useWeek } from '@/contexts/WeekContext';
import { useVisiblePolling } from '@/components/sweat/useSweat';
import { FEED_MESSAGE_MAX, FEED_REACTIONS, type FeedMessage, type FeedResponse } from '@/lib/feed';
import { cn } from '@/lib/utils';

const POLL_MS = 20_000;

const initials = (name: string) =>
	name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);

function timeAgo(iso: string) {
	const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
	if (seconds < 60) return 'now';
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h`;
	return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Newest-first pages merged into one oldest-first list, de-duplicated by id. */
function merge(current: FeedMessage[], incoming: FeedMessage[]) {
	const byId = new Map(current.map(m => [m.id, m]));
	incoming.forEach(m => byId.set(m.id, m));
	return Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function Reactions({ message, onReact }: { message: FeedMessage; onReact: (emoji: string) => void }) {
	const [open, setOpen] = useState(false);
	const used = Object.entries(message.reactions);
	return (
		<div className='mt-1.5 flex flex-wrap items-center gap-1'>
			{used.map(([emoji, count]) => (
				<button
					key={emoji}
					type='button'
					onClick={() => onReact(emoji)}
					aria-pressed={message.mine.includes(emoji)}
					className={cn(
						'inline-flex h-6 items-center gap-1 rounded-full border px-1.5 text-xs tabular transition-colors',
						message.mine.includes(emoji) ? 'border-primary/50 bg-primary/15 text-foreground' : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08]'
					)}
				>
					<span>{emoji}</span>
					{count}
				</button>
			))}
			<div className='relative'>
				<button
					type='button'
					onClick={() => setOpen(o => !o)}
					className='grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/[0.08] hover:text-foreground'
					aria-label='Add reaction'
					aria-expanded={open}
				>
					<SmilePlus className='h-3.5 w-3.5' />
				</button>
				{open && (
					<div className='absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-full border border-white/10 bg-[hsl(var(--surface-raised))] p-1 shadow-xl'>
						{FEED_REACTIONS.map(emoji => (
							<button
								key={emoji}
								type='button'
								onClick={() => {
									onReact(emoji);
									setOpen(false);
								}}
								className='grid h-8 w-8 place-items-center rounded-full text-base transition-transform hover:scale-125'
								aria-label={`React ${emoji}`}
							>
								{emoji}
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

/** The league's trash talk: members' messages plus auto-posted game-day moments. */
export function LeagueFeed({ leagueId, isCommissioner = false, className }: { leagueId: string; isCommissioner?: boolean; className?: string }) {
	const { data: session } = useSession();
	const userId = session?.user?.id;
	const { liveWeek, isPastSeason } = useWeek();
	const [messages, setMessages] = useState<FeedMessage[] | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [text, setText] = useState('');
	const [sending, setSending] = useState(false);
	const listRef = useRef<HTMLDivElement>(null);
	const stickToBottom = useRef(true);
	// The first page decides whether older messages exist; polls only add new ones
	const firstPageRef = useRef(true);

	const load = useCallback(async () => {
		try {
			const week = !isPastSeason && liveWeek ? `?week=${liveWeek}` : '';
			const res = await fetch(`/api/league/${leagueId}/feed${week}`, { cache: 'no-store' });
			if (!res.ok) throw new Error(`Failed to load feed (${res.status})`);
			const data: FeedResponse = await res.json();
			setMessages(prev => merge(prev ?? [], data.messages));
			if (firstPageRef.current) {
				firstPageRef.current = false;
				setHasMore(data.hasMore);
			}
		} catch (error) {
			console.error(error);
			setMessages(prev => prev ?? []);
		}
	}, [leagueId, liveWeek, isPastSeason]);

	useEffect(() => {
		setMessages(null);
		stickToBottom.current = true;
		firstPageRef.current = true;
		load();
	}, [load]);
	useVisiblePolling(load, POLL_MS, true);

	// Keep the newest message in view unless the reader scrolled up
	useEffect(() => {
		const el = listRef.current;
		if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
	}, [messages]);

	const loadOlder = async () => {
		if (!messages?.length) return;
		setLoadingMore(true);
		try {
			const res = await fetch(`/api/league/${leagueId}/feed?before=${encodeURIComponent(messages[0].createdAt)}`, { cache: 'no-store' });
			if (!res.ok) throw new Error();
			const data: FeedResponse = await res.json();
			stickToBottom.current = false;
			setMessages(prev => merge(prev ?? [], data.messages));
			setHasMore(data.hasMore);
		} catch {
			toast.error('Couldn’t load older messages');
		} finally {
			setLoadingMore(false);
		}
	};

	const send = async () => {
		const body = text.trim();
		if (!body || sending) return;
		setSending(true);
		try {
			const res = await fetch(`/api/league/${leagueId}/feed`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: body }) });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Couldn’t post that');
			stickToBottom.current = true;
			setMessages(prev => merge(prev ?? [], [data]));
			setText('');
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Couldn’t post that');
		} finally {
			setSending(false);
		}
	};

	const react = async (messageId: string, emoji: string) => {
		try {
			const res = await fetch(`/api/league/${leagueId}/feed`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messageId, emoji }) });
			if (!res.ok) throw new Error();
			const updated: FeedMessage = await res.json();
			setMessages(prev => (prev ? prev.map(m => (m.id === updated.id ? updated : m)) : prev));
		} catch {
			toast.error('Couldn’t react');
		}
	};

	const remove = async (messageId: string) => {
		try {
			const res = await fetch(`/api/league/${leagueId}/feed?messageId=${messageId}`, { method: 'DELETE' });
			if (!res.ok) throw new Error();
			setMessages(prev => (prev ? prev.filter(m => m.id !== messageId) : prev));
		} catch {
			toast.error('Couldn’t delete that');
		}
	};

	return (
		<Card className={cn('flex flex-col overflow-hidden p-0', className)}>
			<div className='flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3'>
				<h3 className='flex items-center gap-2 font-display text-lg font-bold uppercase italic tracking-tight'>
					<span className='grid h-7 w-7 place-items-center rounded-lg bg-accent-2/10 text-accent-2'>
						<MessageCircle className='h-3.5 w-3.5' />
					</span>
					Trash Talk
				</h3>
				<span className='text-[11px] text-muted-foreground'>Big moments post themselves</span>
			</div>

			<div
				ref={listRef}
				onScroll={e => {
					const el = e.currentTarget;
					stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
				}}
				className='max-h-[28rem] min-h-[12rem] flex-1 space-y-3 overflow-y-auto px-4 py-3'
			>
				{messages === null ? (
					[0, 1, 2].map(i => <Skeleton key={i} className='h-12 rounded-xl' />)
				) : messages.length === 0 ? (
					<div className='flex h-40 flex-col items-center justify-center gap-2 text-center'>
						<span className='text-3xl' aria-hidden>
							🎤
						</span>
						<p className='text-sm font-semibold'>It’s quiet in here.</p>
						<p className='max-w-[16rem] text-xs text-muted-foreground'>Say something bold. Upsets, lock busts and perfect weeks will show up here on their own.</p>
					</div>
				) : (
					<>
						{hasMore && (
							<button type='button' onClick={loadOlder} disabled={loadingMore} className='mx-auto block text-xs font-semibold text-primary hover:underline'>
								{loadingMore ? 'Loading…' : 'Load older messages'}
							</button>
						)}
						{messages.map(message =>
							message.kind === 'moment' ? (
								<div key={message.id} className='rounded-xl border border-white/[0.07] bg-gradient-to-r from-accent-2/[0.08] to-transparent px-3 py-2'>
									<div className='flex items-start gap-2'>
										<span className='text-lg leading-none' aria-hidden>
											{message.emoji}
										</span>
										<div className='min-w-0 flex-1'>
											<p className='text-sm font-medium leading-snug'>{message.text}</p>
											<p className='mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground'>
												{message.week ? `Week ${message.week} · ` : ''}
												{timeAgo(message.createdAt)}
											</p>
										</div>
									</div>
									<Reactions message={message} onReact={emoji => react(message.id, emoji)} />
								</div>
							) : (
								<div key={message.id} className='group flex gap-2.5'>
									<Avatar className={cn('h-8 w-8 shrink-0 ring-1', message.userId === userId ? 'ring-primary/50' : 'ring-white/10')}>
										<AvatarImage src={message.image || undefined} alt={message.name ?? ''} />
										<AvatarFallback className='bg-primary/15 text-[10px] font-bold text-primary'>{initials(message.name ?? '?')}</AvatarFallback>
									</Avatar>
									<div className='min-w-0 flex-1'>
										<p className='flex items-baseline gap-2'>
											<span className={cn('truncate text-xs font-semibold', message.userId === userId ? 'text-primary' : 'text-foreground')}>{message.name}</span>
											<span className='text-[10px] text-muted-foreground'>{timeAgo(message.createdAt)}</span>
											{(message.userId === userId || isCommissioner) && (
												<button
													type='button'
													onClick={() => remove(message.id)}
													className='ml-auto text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100'
													aria-label='Delete message'
												>
													<Trash2 className='h-3.5 w-3.5' />
												</button>
											)}
										</p>
										<p className='whitespace-pre-wrap break-words text-sm leading-snug'>{message.text}</p>
										<Reactions message={message} onReact={emoji => react(message.id, emoji)} />
									</div>
								</div>
							)
						)}
					</>
				)}
			</div>

			<form
				onSubmit={e => {
					e.preventDefault();
					send();
				}}
				className='flex items-end gap-2 border-t border-white/[0.06] p-3'
			>
				<textarea
					value={text}
					onChange={e => setText(e.target.value.slice(0, FEED_MESSAGE_MAX))}
					onKeyDown={e => {
						if (e.key === 'Enter' && !e.shiftKey) {
							e.preventDefault();
							send();
						}
					}}
					rows={1}
					placeholder='Talk your trash…'
					aria-label='Message'
					className='max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
				/>
				<button
					type='submit'
					disabled={!text.trim() || sending}
					className='grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity disabled:opacity-40'
					aria-label='Send'
				>
					{sending ? <Loader2 className='h-4 w-4 animate-spin' /> : <SendHorizontal className='h-4 w-4' />}
				</button>
			</form>
		</Card>
	);
}
