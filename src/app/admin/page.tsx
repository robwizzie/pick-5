'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';
import {
	Archive,
	BarChart3,
	BellRing,
	CalendarRange,
	CheckCircle2,
	ChevronRight,
	Clock,
	Crosshair,
	DatabaseZap,
	Eye,
	Info,
	PauseCircle,
	PenLine,
	PlayCircle,
	Radio,
	RefreshCw,
	ShieldCheck,
	TriangleAlert,
	Trophy,
	Wrench,
	XCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PageContainer, PageHeader, Pill, SectionHeader, StatTile } from '@/components/ui/page';
import { getCurrentSeasonYear } from '@/lib/seasonYear';
import { cn } from '@/lib/utils';

interface AdminTool {
	title: string;
	description: string;
	href: string;
	icon: LucideIcon;
	category: 'odds' | 'picks';
}

const adminTools: AdminTool[] = [
	{
		title: 'Fetch Odds',
		description: 'Manually trigger odds fetch from The Odds API and store in database',
		href: '/admin/fetch-odds',
		icon: Radio,
		category: 'odds'
	},
	{
		title: 'Bulk Fix Odds',
		description: 'View all games missing odds and add them in bulk',
		href: '/admin/bulk-fix-odds',
		icon: BarChart3,
		category: 'odds'
	},
	{
		title: 'Fix Single Game Odds',
		description: 'Update odds for a specific game (updates picks + creates snapshot)',
		href: '/admin/fix-odds',
		icon: Crosshair,
		category: 'odds'
	},
	{
		title: 'Fix Pick Odds',
		description: 'Retroactively add odds to existing picks and recalculate points',
		href: '/admin/fix-pick-odds',
		icon: Wrench,
		category: 'odds'
	},
	{
		title: 'Manual Picks Entry',
		description: 'Enter picks for any user in any league, even after games have started',
		href: '/admin/manual-picks',
		icon: PenLine,
		category: 'picks'
	},
	{
		title: 'Nudge Report',
		description: 'See whether nudged players made their picks, by channel, against players who weren’t nudged',
		href: '/admin/nudges',
		icon: BellRing,
		category: 'picks'
	}
];

const systemInfo: { label: string; value: string }[] = [
	{ label: 'Environment', value: 'Production' },
	{ label: 'Odds API Provider', value: 'The Odds API' },
	{ label: 'Cron Schedule', value: 'Sun 9AM, Tue/Thu/Fri/Sat 2PM' },
	{ label: 'Database', value: 'MongoDB (Connected)' }
];

// ---------- Season management types ----------

interface SeasonStatus {
	isActive: boolean;
	seasonYear: number;
	currentWeek: number;
	startWeek?: number;
	finalWeek?: number;
	lastCompletedWeek: number;
	isArchived: boolean;
	canSubmitPicks: boolean;
	canSendNotifications?: boolean;
	message?: string;
}

type SeasonAction = 'migrate_picks' | 'archive' | 'set_weeks' | 'deactivate' | 'start_new';

interface SeasonActionResponse {
	success?: boolean;
	message?: string;
	error?: string;
	details?: string;
	// migrate_picks
	backfilled?: number;
	droppedLegacyIndex?: boolean;
	alreadyMigrated?: boolean;
	// set_weeks
	startWeek?: number;
	finalWeek?: number;
	// archive
	seasonYear?: number;
	leaguesArchived?: number;
	skipped?: number;
	dryRun?: boolean;
	previews?: ArchivePreview[];
	errors?: string[];
}

interface ArchivePreview {
	leagueId: string;
	leagueName: string;
	players: number;
	weeksPlayed: number;
	champions: string[];
	podium: Array<{ rank: number; name: string; points: number }>;
}

interface ActionResult {
	action: SeasonAction;
	ok: boolean;
	message: string;
	facts: { label: string; value: string }[];
	errors: string[];
	at: Date;
}

const ACTION_LABELS: Record<SeasonAction, string> = {
	migrate_picks: 'Migrate picks',
	archive: 'Archive season',
	set_weeks: 'Season weeks',
	deactivate: 'Deactivate season',
	start_new: 'Start new season'
};

function buildFacts(action: SeasonAction, data: SeasonActionResponse): ActionResult['facts'] {
	if (action === 'migrate_picks') {
		return [
			{ label: 'Picks backfilled', value: String(data.backfilled ?? 0) },
			{ label: 'Legacy index dropped', value: data.droppedLegacyIndex ? 'Yes' : 'No' },
			{ label: 'Already migrated', value: data.alreadyMigrated ? 'Yes' : 'No' }
		];
	}
	if (action === 'set_weeks') {
		return [
			{ label: 'Season', value: data.seasonYear !== undefined ? String(data.seasonYear) : '—' },
			{ label: 'Weeks that count', value: data.startWeek && data.finalWeek ? `${data.startWeek}–${data.finalWeek}` : '—' }
		];
	}
	if (action === 'archive') {
		return [
			{ label: 'Season', value: data.seasonYear !== undefined ? String(data.seasonYear) : '—' },
			data.dryRun ? { label: 'Leagues with picks', value: String(data.previews?.length ?? 0) } : { label: 'Leagues archived', value: String(data.leaguesArchived ?? 0) },
			{ label: 'Skipped', value: String(data.skipped ?? 0) }
		];
	}
	return [];
}

function SeasonStatusSkeleton() {
	return (
		<div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
			{Array.from({ length: 4 }).map((_, i) => (
				<Skeleton key={i} className='h-[120px] rounded-2xl' />
			))}
		</div>
	);
}

function ActionRow({
	icon: Icon,
	title,
	description,
	tone = 'primary',
	children
}: {
	icon: LucideIcon;
	title: string;
	description: React.ReactNode;
	tone?: 'primary' | 'hot' | 'accent';
	children: React.ReactNode;
}) {
	const tones = {
		primary: 'bg-primary/10 text-primary',
		hot: 'bg-accent-2/10 text-accent-2',
		accent: 'bg-accent/10 text-accent'
	} as const;
	return (
		<div className='flex flex-col gap-4 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between'>
			<div className='flex min-w-0 gap-3'>
				<span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', tones[tone])}>
					<Icon className='h-4 w-4' />
				</span>
				<div className='min-w-0'>
					<p className='font-semibold text-foreground'>{title}</p>
					<p className='mt-1 text-sm text-muted-foreground'>{description}</p>
				</div>
			</div>
			<div className='flex shrink-0 flex-wrap items-end gap-2 sm:justify-end'>{children}</div>
		</div>
	);
}

function SeasonManagement() {
	const [status, setStatus] = useState<SeasonStatus | null>(null);
	const [statusLoading, setStatusLoading] = useState(true);
	const [statusError, setStatusError] = useState<string | null>(null);
	const [running, setRunning] = useState<SeasonAction | null>(null);
	const [archiveYear, setArchiveYear] = useState<string>(String(getCurrentSeasonYear() - 1));
	const [confirmAction, setConfirmAction] = useState<'deactivate' | 'start_new' | null>(null);
	const [lastResult, setLastResult] = useState<ActionResult | null>(null);
	const [archiveReplace, setArchiveReplace] = useState(false);
	const [archivePreviews, setArchivePreviews] = useState<{ seasonYear: number; dryRun: boolean; leagues: ArchivePreview[] } | null>(null);
	// Weeks that count, per season
	const [weeksYear, setWeeksYear] = useState<string>(String(getCurrentSeasonYear()));
	const [startWeek, setStartWeek] = useState('');
	const [finalWeek, setFinalWeek] = useState('');

	const loadWeeks = useCallback(async (year: string) => {
		const season = Number(year);
		if (!Number.isInteger(season) || season < 2000) return;
		try {
			const response = await fetch(`/api/season/weeks?season=${season}`, { cache: 'no-store' });
			if (!response.ok) return;
			const data: { startWeek: number; finalWeek: number } = await response.json();
			setStartWeek(String(data.startWeek));
			setFinalWeek(String(data.finalWeek));
		} catch (err) {
			console.error('Error loading season weeks:', err);
		}
	}, []);

	useEffect(() => {
		loadWeeks(weeksYear);
	}, [loadWeeks, weeksYear]);

	const loadStatus = useCallback(async () => {
		setStatusLoading(true);
		setStatusError(null);
		try {
			const response = await fetch('/api/admin/season', { cache: 'no-store' });
			const data: SeasonStatus & { error?: string } = await response.json();
			if (!response.ok) throw new Error(data.error || 'Failed to load season status');
			setStatus(data);
		} catch (err) {
			console.error('Error loading season status:', err);
			setStatusError(err instanceof Error ? err.message : 'Failed to load season status');
		} finally {
			setStatusLoading(false);
		}
	}, []);

	useEffect(() => {
		loadStatus();
	}, [loadStatus]);

	const runAction = async (action: SeasonAction, { dryRun = false }: { dryRun?: boolean } = {}) => {
		const body: { action: SeasonAction; seasonYear?: number; dryRun?: boolean; replace?: boolean; startWeek?: number; finalWeek?: number } = { action };
		if (action === 'set_weeks') {
			const year = Number(weeksYear);
			const start = Number(startWeek);
			const final = Number(finalWeek);
			if (!Number.isInteger(year) || year < 2000) {
				toast.error('Enter a valid season year');
				return;
			}
			if (!Number.isInteger(start) || !Number.isInteger(final) || start < 1 || final > 18 || start > final) {
				toast.error('Weeks must be 1–18 with the start week on or before the final week');
				return;
			}
			Object.assign(body, { seasonYear: year, startWeek: start, finalWeek: final });
		}
		if (action === 'archive') {
			const year = Number(archiveYear);
			if (!Number.isInteger(year) || year < 2000) {
				toast.error('Enter a valid season year');
				return;
			}
			body.seasonYear = year;
			body.dryRun = dryRun;
			body.replace = archiveReplace;
		}

		setRunning(action);
		try {
			const response = await fetch('/api/admin/season', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			const data: SeasonActionResponse = await response.json();
			const ok = response.ok && data.success !== false;
			const message = ok
				? data.message || `${ACTION_LABELS[action]} complete`
				: [data.error || data.message || `${ACTION_LABELS[action]} failed`, data.details].filter(Boolean).join(': ');

			setLastResult({ action, ok, message, facts: response.ok ? buildFacts(action, data) : [], errors: data.errors ?? [], at: new Date() });
			if (action === 'archive' && data.previews) {
				setArchivePreviews({ seasonYear: data.seasonYear ?? Number(archiveYear), dryRun: !!data.dryRun, leagues: data.previews });
			}
			if (ok) toast.success(message);
			else toast.error(message);
		} catch (err) {
			console.error(`Error running season action ${action}:`, err);
			const message = err instanceof Error ? err.message : 'An unexpected error occurred';
			setLastResult({ action, ok: false, message, facts: [], errors: [], at: new Date() });
			toast.error(message);
		} finally {
			setRunning(null);
			loadStatus();
			if (action === 'set_weeks') loadWeeks(weeksYear);
		}
	};

	const confirmCopy = {
		deactivate: {
			title: 'Deactivate season?',
			description:
				'Stops accepting picks and stops sending notifications for the current season, and marks its final week as the last completed week. You can turn it back on later with "Start new season".',
			confirm: 'Deactivate',
			variant: 'destructive' as const
		},
		start_new: {
			title: 'Start new season?',
			description: `Activates season ${getCurrentSeasonYear()} and resets its progress (last completed week, archived flag). Picks are migrated to be season-scoped first.`,
			confirm: 'Start season',
			variant: 'default' as const
		}
	};
	const dialog = confirmAction ? confirmCopy[confirmAction] : null;
	const busy = running !== null;

	return (
		<section>
			<SectionHeader
				title='Season management'
				icon={CalendarRange}
				action={
					<Button variant='ghost' size='sm' onClick={loadStatus} disabled={statusLoading}>
						<RefreshCw className={cn(statusLoading && 'animate-spin')} />
						Refresh
					</Button>
				}
			/>

			<div className='space-y-4'>
				{statusLoading && !status ? (
					<SeasonStatusSkeleton />
				) : statusError && !status ? (
					<Alert variant='destructive'>
						<XCircle />
						<AlertTitle>Couldn&apos;t load season status</AlertTitle>
						<AlertDescription>{statusError}</AlertDescription>
					</Alert>
				) : status ? (
					<>
						<div className='grid grid-cols-2 gap-3 lg:grid-cols-4'>
							<StatTile label='Season' value={status.seasonYear} icon={Trophy} tone='primary' sub={status.isArchived ? 'Archived to League History' : 'Not archived'} />
							<StatTile label='Current week' value={status.currentWeek} icon={Clock} tone='primary' sub={status.startWeek && status.finalWeek ? `Season counts weeks ${status.startWeek}–${status.finalWeek}` : 'From the NFL schedule'} />
							<StatTile label='Last completed' value={status.lastCompletedWeek || '—'} icon={CheckCircle2} tone='accent' sub='Week fully scored' />
							<StatTile
								label='Picks'
								value={status.canSubmitPicks ? 'Open' : 'Closed'}
								icon={status.canSubmitPicks ? PlayCircle : PauseCircle}
								tone={status.canSubmitPicks ? 'accent' : 'hot'}
								sub={status.canSubmitPicks ? 'Players can submit picks' : 'Pick submission is off'}
							/>
						</div>
						<div className='flex flex-wrap items-center gap-2'>
							<Pill tone={status.isActive ? 'accent' : 'hot'}>{status.isActive ? 'Season active' : 'Season inactive'}</Pill>
							<Pill tone={status.isArchived ? 'primary' : 'muted'}>{status.isArchived ? 'Archived' : 'Not archived'}</Pill>
							<Pill tone={status.canSubmitPicks ? 'accent' : 'muted'}>{status.canSubmitPicks ? 'Picks open' : 'Picks closed'}</Pill>
							{status.canSendNotifications !== undefined && (
								<Pill tone={status.canSendNotifications ? 'primary' : 'muted'}>{status.canSendNotifications ? 'Notifications on' : 'Notifications off'}</Pill>
							)}
						</div>
						{status.message && (
							<Alert variant='warning'>
								<Info />
								<AlertDescription>{status.message}</AlertDescription>
							</Alert>
						)}
					</>
				) : null}

				<Card>
					<CardContent className='space-y-3 p-4 sm:p-5'>
						<ActionRow
							icon={CalendarRange}
							title='Season weeks'
							description='The first and last weeks that count for a season. Picks, standings, stats, badges and reminders only use these weeks. Defaults to weeks 1–17. If you add weeks back to an archived season, re-archive it with "Replace existing".'>
							{[
								{ id: 'weeks-year', label: 'Season', value: weeksYear, set: setWeeksYear, min: 2000, max: getCurrentSeasonYear(), width: 'w-24' },
								{ id: 'weeks-start', label: 'Start wk', value: startWeek, set: setStartWeek, min: 1, max: 18, width: 'w-20' },
								{ id: 'weeks-final', label: 'Final wk', value: finalWeek, set: setFinalWeek, min: 1, max: 18, width: 'w-20' }
							].map(field => (
								<div key={field.id} className={cn('space-y-1.5', field.width)}>
									<Label htmlFor={field.id} className='eyebrow'>
										{field.label}
									</Label>
									<Input
										id={field.id}
										type='number'
										inputMode='numeric'
										min={field.min}
										max={field.max}
										value={field.value}
										onChange={e => field.set(e.target.value)}
										disabled={busy}
										className='tabular h-10'
									/>
								</div>
							))}
							<Button variant='outline' onClick={() => runAction('set_weeks')} disabled={busy || !weeksYear || !startWeek || !finalWeek}>
								{running === 'set_weeks' ? <RefreshCw className='animate-spin' /> : <CalendarRange />}
								{running === 'set_weeks' ? 'Saving…' : 'Save'}
							</Button>
						</ActionRow>

						<ActionRow
							icon={DatabaseZap}
							title='Migrate picks to season scope'
							description="Tags existing picks with their season and replaces the old unique index so a new season's picks don't collide with last season's. Safe to run more than once.">
							<Button variant='outline' onClick={() => runAction('migrate_picks')} disabled={busy}>
								{running === 'migrate_picks' ? <RefreshCw className='animate-spin' /> : <DatabaseZap />}
								{running === 'migrate_picks' ? 'Migrating…' : 'Run migration'}
							</Button>
						</ActionRow>

						<ActionRow
							icon={Archive}
							title='Archive season standings'
							description='Saves the final standings of every league for the chosen season into League History. Use the previous year to archive last season after a new one has started.'>
							<div className='w-28 space-y-1.5'>
								<Label htmlFor='archive-year' className='eyebrow'>
									Season
								</Label>
								<Input
									id='archive-year'
									type='number'
									inputMode='numeric'
									min={2000}
									max={getCurrentSeasonYear()}
									value={archiveYear}
									onChange={e => setArchiveYear(e.target.value)}
									disabled={busy}
									className='tabular h-10'
								/>
							</div>
							<label className='flex items-center gap-2 text-xs text-muted-foreground'>
								<Switch checked={archiveReplace} onCheckedChange={setArchiveReplace} disabled={busy} aria-label='Replace existing history' />
								Replace existing
							</label>
							<Button variant='ghost' onClick={() => runAction('archive', { dryRun: true })} disabled={busy || !archiveYear}>
								<Eye /> Preview
							</Button>
							<Button variant='outline' onClick={() => runAction('archive')} disabled={busy || !archiveYear}>
								{running === 'archive' ? <RefreshCw className='animate-spin' /> : <Archive />}
								{running === 'archive' ? 'Working…' : 'Archive'}
							</Button>
						</ActionRow>

						{archivePreviews && (
							<div className='rounded-xl border border-white/[0.07] bg-white/[0.02] p-4'>
								<p className='eyebrow mb-3'>
									{archivePreviews.dryRun ? 'Preview' : 'Archived'} · {archivePreviews.seasonYear} season · {archivePreviews.leagues.length} league{archivePreviews.leagues.length === 1 ? '' : 's'} with picks
								</p>
								{archivePreviews.leagues.length === 0 ? (
									<p className='text-sm text-muted-foreground'>No league has picks tagged to {archivePreviews.seasonYear}. Run the pick migration first, or check the season year.</p>
								) : (
									<div className='overflow-x-auto'>
										<table className='w-full text-sm'>
											<thead className='text-left text-[11px] uppercase tracking-wider text-muted-foreground'>
												<tr>
													<th className='py-2 pr-3 font-semibold'>League</th>
													<th className='py-2 pr-3 font-semibold'>Players</th>
													<th className='py-2 pr-3 font-semibold'>Weeks</th>
													<th className='py-2 font-semibold'>Final podium</th>
												</tr>
											</thead>
											<tbody className='divide-y divide-white/[0.05]'>
												{archivePreviews.leagues.map(l => (
													<tr key={l.leagueId} className='align-top'>
														<td className='py-2 pr-3 font-semibold'>{l.leagueName}</td>
														<td className='py-2 pr-3 tabular'>{l.players}</td>
														<td className='py-2 pr-3 tabular'>{l.weeksPlayed}</td>
														<td className='py-2'>
															{l.podium.map(p => (
																<div key={`${p.rank}-${p.name}`} className='tabular'>
																	<span className={cn('font-bold', p.rank === 1 ? 'text-[#FFD66B]' : p.rank === 2 ? 'text-[#D5DCE6]' : 'text-[#E7A16B]')}>#{p.rank}</span> {p.name} · {p.points} pts
																</div>
															))}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>
						)}

						<ActionRow
							icon={PlayCircle}
							tone='accent'
							title='Start new season'
							description={`Activates the ${getCurrentSeasonYear()} season so picks and notifications resume. Runs the pick migration first.`}>
							<Button variant='success' onClick={() => setConfirmAction('start_new')} disabled={busy || status?.isActive === true}>
								{running === 'start_new' ? <RefreshCw className='animate-spin' /> : <PlayCircle />}
								{running === 'start_new' ? 'Starting…' : 'Start season'}
							</Button>
						</ActionRow>

						<ActionRow
							icon={PauseCircle}
							tone='hot'
							title='Deactivate season'
							description='Stops accepting picks and sending notifications. Use when the season’s final week is complete.'>
							<Button variant='destructive' onClick={() => setConfirmAction('deactivate')} disabled={busy}>
								{running === 'deactivate' ? <RefreshCw className='animate-spin' /> : <PauseCircle />}
								{running === 'deactivate' ? 'Deactivating…' : 'Deactivate'}
							</Button>
						</ActionRow>
					</CardContent>
				</Card>

				{lastResult && (
					<Alert variant={lastResult.ok ? 'success' : 'destructive'} className='animate-fade-in'>
						{lastResult.ok ? <CheckCircle2 /> : <XCircle />}
						<AlertTitle className='flex flex-wrap items-center gap-2'>
							{ACTION_LABELS[lastResult.action]}
							<span className='text-xs font-normal text-muted-foreground'>{lastResult.at.toLocaleTimeString()}</span>
						</AlertTitle>
						<AlertDescription className='space-y-3'>
							<p className={cn(lastResult.ok ? 'text-foreground' : 'text-destructive')}>{lastResult.message}</p>
							{lastResult.facts.length > 0 && (
								<dl className='grid grid-cols-2 gap-2 sm:grid-cols-3'>
									{lastResult.facts.map(fact => (
										<div key={fact.label} className='rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2'>
											<dt className='eyebrow'>{fact.label}</dt>
											<dd className='mt-1 font-display text-xl font-bold italic tabular text-foreground'>{fact.value}</dd>
										</div>
									))}
								</dl>
							)}
							{lastResult.errors.length > 0 && (
								<ul className='list-inside list-disc space-y-1 text-xs text-destructive'>
									{lastResult.errors.map((e, i) => (
										<li key={i}>{e}</li>
									))}
								</ul>
							)}
						</AlertDescription>
					</Alert>
				)}
			</div>

			<Dialog open={confirmAction !== null} onOpenChange={open => !open && setConfirmAction(null)}>
				<DialogContent className='sm:max-w-md'>
					{dialog && (
						<>
							<DialogHeader>
								<DialogTitle>{dialog.title}</DialogTitle>
								<DialogDescription>{dialog.description}</DialogDescription>
							</DialogHeader>
							<DialogFooter>
								<Button variant='ghost' onClick={() => setConfirmAction(null)}>
									Cancel
								</Button>
								<Button
									variant={dialog.variant}
									onClick={() => {
										const action = confirmAction;
										setConfirmAction(null);
										if (action) runAction(action);
									}}>
									{dialog.confirm}
								</Button>
							</DialogFooter>
						</>
					)}
				</DialogContent>
			</Dialog>
		</section>
	);
}

function ToolGrid({ tools }: { tools: AdminTool[] }) {
	return (
		<div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'>
			{tools.map(({ href, icon: Icon, title, description }) => (
				<Link key={href} href={href} className='group rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'>
					<Card className='h-full p-5 transition-colors group-hover:border-primary/40 group-hover:bg-white/[0.04]'>
						<div className='flex items-start justify-between gap-3'>
							<span className='grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary'>
								<Icon className='h-5 w-5' />
							</span>
							<ChevronRight className='h-5 w-5 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary' />
						</div>
						<p className='mt-4 font-display text-xl font-bold uppercase italic tracking-tight transition-colors group-hover:text-primary'>{title}</p>
						<p className='mt-1 text-sm text-muted-foreground'>{description}</p>
					</Card>
				</Link>
			))}
		</div>
	);
}

export default function AdminDashboard() {
	const oddsList = adminTools.filter(t => t.category === 'odds');
	const picksList = adminTools.filter(t => t.category === 'picks');

	return (
		<PageContainer>
			<PageHeader eyebrow={<><ShieldCheck className='h-3.5 w-3.5' /> Admin</>} title='Dashboard' description='Manage Pick 5 data, odds, seasons and system operations' />

			<div className='space-y-10'>
				<div className='grid grid-cols-2 gap-3'>
					<StatTile label='Cron jobs' value='2' icon={Clock} tone='accent' sub='Master cron (odds + emails)' />
					<StatTile label='Access level' value='Admin' icon={ShieldCheck} tone='primary' sub='Full system access' />
				</div>

				<SeasonManagement />

				<section>
					<SectionHeader title='Odds management' icon={BarChart3} />
					<ToolGrid tools={oddsList} />
				</section>

				<section>
					<SectionHeader title='Picks management' icon={PenLine} />
					<ToolGrid tools={picksList} />
				</section>

				<div className='grid gap-4 lg:grid-cols-2'>
					<Card>
						<CardHeader>
							<CardTitle className='text-xl'>System information</CardTitle>
							<CardDescription>Runtime configuration at a glance</CardDescription>
						</CardHeader>
						<CardContent>
							<dl className='divide-y divide-white/[0.06]'>
								{systemInfo.map(row => (
									<div key={row.label} className='flex items-center justify-between gap-4 py-2.5 text-sm'>
										<dt className='text-muted-foreground'>{row.label}</dt>
										<dd className='text-right font-mono text-xs sm:text-sm'>{row.value}</dd>
									</div>
								))}
							</dl>
						</CardContent>
					</Card>

					<Alert variant='warning' className='h-fit rounded-2xl p-5'>
						<TriangleAlert />
						<AlertTitle>Important notes</AlertTitle>
						<AlertDescription>
							<ul className='mt-2 space-y-2 text-muted-foreground'>
								<li>
									<strong className='text-foreground'>API limit:</strong> The Odds API has a 500 calls/month limit. Use manual fetch sparingly.
								</li>
								<li>
									<strong className='text-foreground'>Odds snapshots:</strong> Snapshots are created automatically and can be manually added for games that need corrections.
								</li>
								<li>
									<strong className='text-foreground'>Cron jobs:</strong> Automatically fetch odds and send email reminders via scheduled cron jobs.
								</li>
								<li>
									<strong className='text-foreground'>Manual picks:</strong> Use the Manual Picks Entry tool to add picks for users who couldn&apos;t submit in time.
								</li>
								<li>
									<strong className='text-foreground'>Access:</strong> This admin panel is only accessible to your user ID.
								</li>
							</ul>
						</AlertDescription>
					</Alert>
				</div>
			</div>
		</PageContainer>
	);
}
