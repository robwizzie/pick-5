'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { BarChart3, LineChart, Target, TrendingUp, Trophy, User, Users } from 'lucide-react';
import CountUp from 'react-countup';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWeek } from '@/contexts/WeekContext';
import { cn } from '@/lib/utils';

interface LeagueStatsProps {
	leagueId: string;
	userId?: string;
	leagueName: string;
}

interface SeasonStatEntry {
	userId?: string;
	player: string;
	image: string | null;
	totalPoints: number;
	totalTFSPoints: number;
	totalPicks: number;
	correctPicks: number;
	weeksWon: number;
}

interface WeeklyResultEntry {
	userId?: string;
	player: string;
	image: string | null;
	points: number;
}

interface LeaderboardResponse {
	weeklyResults?: WeeklyResultEntry[];
	seasonStats?: SeasonStatEntry[];
}

interface WeekPoint {
	week: number;
	points: number;
}

interface Series {
	id: string;
	player: string;
	isMe: boolean;
	color: string;
	weeks: WeekPoint[];
}

interface SeasonSummary {
	rank: number;
	fieldSize: number;
	totalPoints: number;
	winRate: number;
	correctPicks: number;
	totalPicks: number;
	tfsPoints: number;
	weeksWon: number;
}

/** Categorical chart tokens in fixed order. "You" always takes chart-1 (primary blue). */
const SERIES_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'] as const;
const MAX_SERIES = SERIES_COLORS.length;
const TREND_WEEKS = 5;

const EMPTY_SUMMARY: SeasonSummary = { rank: 0, fieldSize: 0, totalPoints: 0, winRate: 0, correctPicks: 0, totalPicks: 0, tfsPoints: 0, weeksWon: 0 };

const RANK_COLORS: Record<number, string> = { 1: 'text-[#FFD66B]', 2: 'text-[#D5DCE6]', 3: 'text-[#E7A16B]' };

function ordinalSuffix(n: number) {
	const mod100 = n % 100;
	if (mod100 >= 11 && mod100 <= 13) return 'th';
	switch (n % 10) {
		case 1:
			return 'st';
		case 2:
			return 'nd';
		case 3:
			return 'rd';
		default:
			return 'th';
	}
}

async function fetchJson<T>(url: string): Promise<T | null> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch (error) {
		console.error(`Error fetching ${url}:`, error);
		return null;
	}
}

export default function LeagueStats({ leagueId, userId, leagueName }: LeagueStatsProps) {
	const { data: session } = useSession();
	const { currentWeek } = useWeek();
	const userName = session?.user?.name ?? null;

	const [loading, setLoading] = useState(true);
	const [summary, setSummary] = useState<SeasonSummary>(EMPTY_SUMMARY);
	const [myTrend, setMyTrend] = useState<WeekPoint[]>([]);
	const [fieldSeries, setFieldSeries] = useState<Series[]>([]);
	const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
	const [viewMode, setViewMode] = useState<'me' | 'everyone'>('me');
	const [hiddenPlayers, setHiddenPlayers] = useState<Set<string>>(new Set());
	const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);

	useEffect(() => {
		if (!leagueId || !userName || !currentWeek) return;
		let cancelled = false;

		const fetchStats = async () => {
			setLoading(true);
			const trendWeeks: number[] = [];
			for (let w = Math.max(1, currentWeek - (TREND_WEEKS - 1)); w <= currentWeek; w++) trendWeeks.push(w);

			// Everything below is independent — fetch it all at once. The current-week
			// leaderboard doubles as the season-stats source.
			const weekly = await Promise.all(trendWeeks.map(week => fetchJson<LeaderboardResponse>(`/api/leaderboard?leagueId=${leagueId}&week=${week}`)));
			if (cancelled) return;

			const current = weekly[weekly.length - 1];
			if (!current) {
				setLoading(false);
				return;
			}

			// Identify users by id (names can collide); fall back to display name.
			const keyOf = (e: { userId?: string; player: string }) => e.userId ?? `name:${e.player}`;
			const isMe = (e: { userId?: string; player: string }) => (userId && e.userId ? e.userId === userId : e.player === userName);

			// Season summary
			const season = [...(current.seasonStats ?? [])].sort((a, b) => (b.totalPoints || 0) - (a.totalPoints || 0));
			const meIndex = season.findIndex(isMe);
			const me = meIndex !== -1 ? season[meIndex] : null;
			if (me) {
				setSummary({
					rank: meIndex + 1,
					fieldSize: season.length,
					totalPoints: me.totalPoints || 0,
					winRate: me.totalPicks > 0 ? Math.round((me.correctPicks / me.totalPicks) * 100) : 0,
					correctPicks: me.correctPicks || 0,
					totalPicks: me.totalPicks || 0,
					tfsPoints: me.totalTFSPoints || 0,
					weeksWon: me.weeksWon || 0
				});
			}

			// Field trend: me + the top of the standings. Colors are assigned in a fixed,
			// deterministic order so they never depend on fetch timing.
			const byPlayer = new Map<string, { player: string; isMe: boolean; weeks: WeekPoint[] }>();
			weekly.forEach((data, i) => {
				data?.weeklyResults?.forEach(r => {
					const key = keyOf(r);
					const entry = byPlayer.get(key) ?? { player: r.player, isMe: isMe(r), weeks: [] };
					entry.weeks.push({ week: trendWeeks[i], points: r.points || 0 });
					byPlayer.set(key, entry);
				});
			});
			const ordered = season.map(keyOf).filter(k => byPlayer.has(k));
			byPlayer.forEach((_, k) => {
				if (!ordered.includes(k)) ordered.push(k);
			});
			const myKey = ordered.find(k => byPlayer.get(k)?.isMe);
			// My trend comes from the same live-scored weekly results as everyone else's
			setMyTrend(myKey ? [...byPlayer.get(myKey)!.weeks].sort((a, b) => a.week - b.week) : []);
			const chosen = [...(myKey ? [myKey] : []), ...ordered.filter(k => k !== myKey)].slice(0, MAX_SERIES);
			setFieldSeries(
				chosen.map((id, i) => {
					const entry = byPlayer.get(id)!;
					return { id, player: entry.player, isMe: entry.isMe, color: SERIES_COLORS[i], weeks: entry.weeks.sort((a, b) => a.week - b.week) };
				})
			);

			setLoading(false);
		};

		fetchStats().catch(error => {
			console.error('Error fetching league stats:', error);
			if (!cancelled) setLoading(false);
		});

		return () => {
			cancelled = true;
		};
	}, [leagueId, userId, userName, currentWeek]);

	const togglePlayer = (id: string) => {
		setHiddenPlayers(prev => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	if (loading) {
		return (
			<div className='space-y-4'>
				<Skeleton className='h-36 rounded-2xl' />
				<div className='grid grid-cols-2 gap-3'>
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className='h-24 rounded-2xl' />
					))}
				</div>
				<Skeleton className='h-80 rounded-2xl' />
			</div>
		);
	}

	const series: Series[] = viewMode === 'me' ? (myTrend.length > 0 ? [{ id: 'me', player: userName ?? 'You', isMe: true, color: SERIES_COLORS[0], weeks: myTrend }] : []) : fieldSeries.filter(s => s.weeks.length > 0);
	const visibleSeries = series.filter(s => !hiddenPlayers.has(s.id) || viewMode === 'me');
	const rankColor = RANK_COLORS[summary.rank] ?? 'text-foreground';
	const record = `${summary.correctPicks}-${summary.totalPicks - summary.correctPicks}`;

	return (
		<div className='space-y-4'>
			{/* Rank hero */}
			<Card className='relative overflow-hidden p-5 animate-slide-up'>
				<div aria-hidden className='pointer-events-none absolute -right-10 -top-16 h-44 w-44 rounded-full bg-primary/20 blur-3xl' />
				<div className='relative flex items-start justify-between gap-3'>
					<div className='min-w-0'>
						<p className='eyebrow truncate'>{leagueName} · Season</p>
						<p className='mt-1 font-display text-lg font-bold uppercase italic tracking-tight'>My Rank</p>
					</div>
					<span className='grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary'>
						<Trophy className='h-4 w-4' />
					</span>
				</div>
				<div className='relative mt-3 flex items-end justify-between gap-4'>
					<div className={cn('flex items-baseline font-display font-extrabold italic leading-none tracking-tight', rankColor)}>
						{summary.rank > 0 ? (
							<>
								<span className='text-7xl'>
									<CountUp end={summary.rank} duration={0.5} />
								</span>
								<span className='ml-1 text-2xl'>{ordinalSuffix(summary.rank)}</span>
							</>
						) : (
							<span className='text-7xl text-muted-foreground'>—</span>
						)}
					</div>
					{summary.fieldSize > 0 && (
						<div className='text-right'>
							<p className='eyebrow'>Of</p>
							<p className='font-display text-2xl font-bold italic tabular text-muted-foreground'>{summary.fieldSize}</p>
						</div>
					)}
				</div>
			</Card>

			{/* Season numbers */}
			<div className='grid grid-cols-2 gap-3'>
				<MiniStat label='Points' tone='primary'>
					<CountUp end={summary.totalPoints} duration={0.5} />
				</MiniStat>
				<MiniStat label='Win %' tone='accent' meter={summary.winRate}>
					<CountUp end={summary.winRate} duration={0.5} />
					<span className='text-xl'>%</span>
				</MiniStat>
				<MiniStat label='Weeks Won' tone='warning'>
					<CountUp end={summary.weeksWon} duration={0.5} />
				</MiniStat>
				<MiniStat label='Record' tone='muted' sub={`${summary.correctPicks}/${summary.totalPicks} correct`}>
					{record}
				</MiniStat>
				{summary.tfsPoints > 0 && (
					<MiniStat label='TFS Points' tone='primary' className='col-span-2'>
						<CountUp end={summary.tfsPoints} duration={0.5} />
					</MiniStat>
				)}
			</div>

			{/* Weekly trend */}
			<Card className='p-4 sm:p-5'>
				<div className='flex items-center justify-between gap-3'>
					<h3 className='flex items-center gap-2 font-display text-lg font-bold uppercase italic tracking-tight'>
						<span className='grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary'>
							<TrendingUp className='h-3.5 w-3.5' />
						</span>
						Weekly Trend
					</h3>
					<p className='eyebrow'>Last {TREND_WEEKS} wks</p>
				</div>

				<div className='mt-3 flex flex-wrap items-center gap-2'>
					<Segmented
						label='Chart type'
						value={chartType}
						onChange={setChartType}
						options={[
							{ value: 'bar', label: 'Bar', icon: BarChart3 },
							{ value: 'line', label: 'Line', icon: LineChart }
						]}
					/>
					<Segmented
						label='Players'
						value={viewMode}
						onChange={setViewMode}
						options={[
							{ value: 'me', label: 'Me', icon: User },
							{ value: 'everyone', label: 'All', icon: Users }
						]}
					/>
				</div>

				<div className='mt-4'>
					{series.length > 0 ? (
						<>
							<TrendChart type={chartType} series={visibleSeries} highlighted={viewMode === 'everyone' ? hoveredPlayer : null} />

							{viewMode === 'everyone' && (
								<ul className='mt-4 grid grid-cols-2 gap-1 border-t border-white/[0.07] pt-3'>
									{series.map(s => {
										const hidden = hiddenPlayers.has(s.id);
										return (
											<li key={s.id} className='min-w-0'>
												<button
													type='button'
													aria-pressed={!hidden}
													onClick={() => togglePlayer(s.id)}
													onMouseEnter={() => setHoveredPlayer(s.id)}
													onMouseLeave={() => setHoveredPlayer(null)}
													onFocus={() => setHoveredPlayer(s.id)}
													onBlur={() => setHoveredPlayer(null)}
													className={cn('flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors hover:bg-white/[0.06]', hidden && 'opacity-40')}
												>
													<span aria-hidden className='h-0.5 w-3.5 shrink-0 rounded-full' style={{ backgroundColor: s.color }} />
													<span className={cn('truncate', hidden && 'line-through', s.isMe ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
														{s.player}
														{s.isMe && ' (You)'}
													</span>
												</button>
											</li>
										);
									})}
								</ul>
							)}
						</>
					) : (
						<div className='flex flex-col items-center rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-10 text-center'>
							<Target className='mb-3 h-6 w-6 text-muted-foreground' />
							<p className='text-sm font-medium'>No data yet</p>
							<p className='mt-1 text-xs text-muted-foreground'>Weekly points show up once games are graded.</p>
						</div>
					)}
				</div>
			</Card>
		</div>
	);
}

/* ------------------------------------------------------------------ */

function MiniStat({
	label,
	tone,
	sub,
	meter,
	className,
	children
}: {
	label: string;
	tone: 'primary' | 'accent' | 'warning' | 'muted';
	sub?: string;
	meter?: number;
	className?: string;
	children: ReactNode;
}) {
	const bar = { primary: 'bg-primary', accent: 'bg-accent', warning: 'bg-warning', muted: 'bg-muted-foreground' }[tone];
	return (
		<div className={cn('glass relative overflow-hidden rounded-2xl p-4', className)}>
			<span aria-hidden className={cn('absolute inset-y-3 left-0 w-0.5 rounded-full opacity-80', bar)} />
			<p className='eyebrow'>{label}</p>
			<p className='mt-1.5 font-display text-3xl font-extrabold italic leading-none tracking-tight tabular'>{children}</p>
			{sub && <p className='mt-1.5 text-[11px] text-muted-foreground tabular'>{sub}</p>}
			{meter !== undefined && (
				<div className='mt-2.5 h-1 overflow-hidden rounded-full bg-accent/15' role='meter' aria-valuemin={0} aria-valuemax={100} aria-valuenow={meter} aria-label={label}>
					<div className='h-full rounded-full bg-accent transition-[width] duration-700 ease-out-expo' style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} />
				</div>
			)}
		</div>
	);
}

function Segmented<T extends string>({
	label,
	value,
	onChange,
	options
}: {
	label: string;
	value: T;
	onChange: (v: T) => void;
	options: { value: T; label: string; icon: ComponentType<{ className?: string }> }[];
}) {
	return (
		<div role='radiogroup' aria-label={label} className='flex items-center gap-0.5 rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5'>
			{options.map(({ value: v, label: l, icon: Icon }) => {
				const active = v === value;
				return (
					<button
						key={v}
						type='button'
						role='radio'
						aria-checked={active}
						onClick={() => onChange(v)}
						className={cn(
							'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
							active ? 'bg-primary text-primary-foreground shadow-primary-glow' : 'text-muted-foreground hover:bg-white/[0.06] hover:text-foreground'
						)}
					>
						<Icon className='h-3.5 w-3.5' />
						{l}
					</button>
				);
			})}
		</div>
	);
}

/* ------------------------------------------------------------------ */

function useElementWidth<T extends HTMLElement>() {
	const ref = useRef<T>(null);
	const [width, setWidth] = useState(0);
	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		setWidth(el.getBoundingClientRect().width);
		const ro = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
		ro.observe(el);
		return () => ro.disconnect();
	}, []);
	return [ref, width] as const;
}

function niceScale(max: number) {
	const target = Math.max(max, 5);
	const steps = [1, 2, 5, 10, 20, 25, 50, 100];
	const step = steps.find(s => target / s <= 4) ?? Math.ceil(target / 4);
	const top = Math.ceil(target / step) * step;
	const ticks: number[] = [];
	for (let t = 0; t <= top; t += step) ticks.push(t);
	return { top, ticks };
}

const CHART_H = 200;
const PAD = { top: 18, right: 8, bottom: 26, left: 28 };

function TrendChart({ type, series, highlighted }: { type: 'bar' | 'line'; series: Series[]; highlighted: string | null }) {
	const [ref, width] = useElementWidth<HTMLDivElement>();
	const [hoverIndex, setHoverIndex] = useState<number | null>(null);

	const weeks = Array.from(new Set(series.flatMap(s => s.weeks.map(w => w.week)))).sort((a, b) => a - b);
	const valueAt = (s: Series, week: number) => s.weeks.find(w => w.week === week)?.points ?? 0;
	const { top, ticks } = niceScale(Math.max(0, ...series.flatMap(s => s.weeks.map(w => w.points))));

	const innerW = Math.max(0, width - PAD.left - PAD.right);
	const innerH = CHART_H - PAD.top - PAD.bottom;
	const band = weeks.length > 0 ? innerW / weeks.length : 0;
	const bandX = (i: number) => PAD.left + band * i;
	const centerX = (i: number) => bandX(i) + band / 2;
	const y = (v: number) => PAD.top + innerH - (v / top) * innerH;

	const single = series.length === 1;
	const groupGap = 2;
	const barW = series.length > 0 ? Math.min(single ? 24 : 12, Math.max(3, (band * 0.7 - groupGap * (series.length - 1)) / series.length)) : 0;
	const groupW = barW * series.length + groupGap * (series.length - 1);

	const seriesOpacity = (s: Series) => (highlighted && highlighted !== s.id ? 0.2 : 1);

	const pickIndex = (clientX: number, rect: DOMRect) => {
		if (band <= 0) return null;
		const i = Math.floor((clientX - rect.left - PAD.left) / band);
		return i >= 0 && i < weeks.length ? i : null;
	};

	// Selective labels on a single line: last point and the season-best point.
	const lineLabelIdx = (s: Series) => {
		const values = weeks.map(w => valueAt(s, w));
		const best = values.indexOf(Math.max(...values));
		return new Set([values.length - 1, best]);
	};

	const hoverWeek = hoverIndex !== null ? weeks[hoverIndex] : null;
	const tooltipLeft = hoverIndex !== null ? Math.min(Math.max(centerX(hoverIndex), 70), Math.max(70, width - 70)) : 0;

	return (
		<div ref={ref} className='relative w-full select-none' style={{ height: CHART_H }}>
			{width > 0 && weeks.length > 0 && (
				<svg
					width={width}
					height={CHART_H}
					role='img'
					aria-label={`Weekly points, weeks ${weeks[0]} to ${weeks[weeks.length - 1]}`}
					onPointerMove={e => setHoverIndex(pickIndex(e.clientX, e.currentTarget.getBoundingClientRect()))}
					onPointerLeave={() => setHoverIndex(null)}
					className='overflow-visible touch-pan-y'
				>
					{/* Grid + y ticks */}
					{ticks.map(t => (
						<g key={t}>
							<line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke='rgba(255,255,255,0.07)' strokeWidth={1} />
							<text x={PAD.left - 8} y={y(t)} dy='0.32em' textAnchor='end' className='fill-muted-foreground text-[10px] tabular'>
								{t}
							</text>
						</g>
					))}

					{/* Hover band */}
					{hoverIndex !== null && (type === 'bar' ? <rect x={bandX(hoverIndex)} y={PAD.top} width={band} height={innerH} rx={6} fill='rgba(255,255,255,0.04)' /> : <line x1={centerX(hoverIndex)} x2={centerX(hoverIndex)} y1={PAD.top} y2={PAD.top + innerH} stroke='rgba(255,255,255,0.25)' strokeWidth={1} />)}

					{/* X labels */}
					{weeks.map((w, i) => (
						<text key={w} x={centerX(i)} y={CHART_H - 6} textAnchor='middle' className={cn('text-[10px] font-semibold tabular', hoverIndex === i ? 'fill-foreground' : 'fill-muted-foreground')}>
							W{w}
						</text>
					))}

					{type === 'bar'
						? weeks.map((w, i) =>
								series.map((s, si) => {
									const v = valueAt(s, w);
									const h = Math.max(v > 0 ? 4 : 1, (v / top) * innerH);
									const x = centerX(i) - groupW / 2 + si * (barW + groupGap);
									const yTop = PAD.top + innerH - h;
									const r = Math.min(4, barW / 2, h);
									return (
										<g key={`${s.id}-${w}`} style={{ opacity: seriesOpacity(s), transition: 'opacity 150ms' }}>
											<path d={`M${x},${PAD.top + innerH} V${yTop + r} Q${x},${yTop} ${x + r},${yTop} H${x + barW - r} Q${x + barW},${yTop} ${x + barW},${yTop + r} V${PAD.top + innerH} Z`} fill={s.color} fillOpacity={hoverIndex === null || hoverIndex === i ? 1 : 0.55} />
											{single && v > 0 && (
												<text x={x + barW / 2} y={yTop - 6} textAnchor='middle' className='fill-foreground text-[11px] font-bold tabular'>
													{v}
												</text>
											)}
										</g>
									);
								})
							)
						: series.map(s => {
								const pts = weeks.map((w, i) => ({ x: centerX(i), y: y(valueAt(s, w)), v: valueAt(s, w) }));
								const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
								const labels = single ? lineLabelIdx(s) : new Set<number>();
								const emphasized = highlighted === s.id || (!highlighted && s.isMe);
								return (
									<g key={s.id} style={{ opacity: seriesOpacity(s), transition: 'opacity 150ms' }}>
										{single && pts.length > 1 && <path d={`${d} L${pts[pts.length - 1].x},${PAD.top + innerH} L${pts[0].x},${PAD.top + innerH} Z`} fill={s.color} fillOpacity={0.1} />}
										<path d={d} fill='none' stroke={s.color} strokeWidth={emphasized ? 2.5 : 2} strokeLinecap='round' strokeLinejoin='round' />
										{pts.map((p, i) => (
											<g key={i}>
												<circle cx={p.x} cy={p.y} r={hoverIndex === i ? 5 : 4} fill={s.color} stroke='hsl(var(--card))' strokeWidth={2} />
												{labels.has(i) && (
													<text x={p.x} y={p.y - 10} textAnchor='middle' className='fill-foreground text-[11px] font-bold tabular'>
														{p.v}
													</text>
												)}
											</g>
										))}
									</g>
								);
							})}
				</svg>
			)}

			{/* Tooltip: every series at the hovered week */}
			{hoverWeek !== null && hoverIndex !== null && (
				<div className='glass-strong pointer-events-none absolute top-0 z-10 min-w-[8.5rem] -translate-x-1/2 rounded-xl px-3 py-2 text-xs' style={{ left: tooltipLeft }}>
					<p className='eyebrow mb-1'>Week {hoverWeek}</p>
					<ul className='space-y-0.5'>
						{[...series]
							.sort((a, b) => valueAt(b, hoverWeek) - valueAt(a, hoverWeek))
							.map(s => (
								<li key={s.id} className='flex items-center gap-2'>
									<span aria-hidden className='h-0.5 w-3 shrink-0 rounded-full' style={{ backgroundColor: s.color }} />
									<span className='font-display text-sm font-bold italic tabular text-foreground'>{valueAt(s, hoverWeek)}</span>
									<span className='max-w-[7rem] truncate text-muted-foreground'>{single ? 'pts' : s.player}</span>
								</li>
							))}
					</ul>
				</div>
			)}

			{/* Table view for assistive tech */}
			<table className='sr-only'>
				<caption>Weekly points</caption>
				<thead>
					<tr>
						<th scope='col'>Player</th>
						{weeks.map(w => (
							<th key={w} scope='col'>
								Week {w}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{series.map(s => (
						<tr key={s.id}>
							<th scope='row'>{s.player}</th>
							{weeks.map(w => (
								<td key={w}>{valueAt(s, w)}</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
