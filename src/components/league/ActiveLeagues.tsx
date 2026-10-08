'use client';

import Link from 'next/link';
import Image from 'next/image';
import { toast } from 'sonner';
import { ArrowUpRight, CheckCircle2, Clock, Crown, HeartPulse, Link as LinkIcon, MoreHorizontal, Skull, Users } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Pill } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import { MatchupMini, type MatchupMiniData } from './MatchupMini';

export interface DashboardLeague {
	_id: string;
	name: string;
	sport?: string;
	creatorId?: string;
	inviteCode?: string;
	mode?: string;
	members?: string[];
}

export interface PickedTeam {
	team: string;
	abbreviation: string;
	logo: string;
	gameStatus: 'scheduled' | 'in_progress' | 'final';
	isCorrect: boolean | null;
}

export interface LeagueSummary {
	hasPicks: boolean;
	weekPoints: number;
	seasonPoints: number;
	rank: number | null;
	totalMembers: number;
	pickedTeams: PickedTeam[];
	tfsPoints: number;
	/** Survivor leagues: the viewer's standing instead of points */
	survivor?: { alive: boolean; eliminatedWeek: number | null; aliveCount: number; champion: boolean; complete: boolean };
}

const RANK_STYLES: Record<number, { text: string; glow: string; label: string }> = {
	1: { text: 'text-[#FFD66B]', glow: 'from-[#FFD66B]/20', label: 'Leader' },
	2: { text: 'text-[#D5DCE6]', glow: 'from-[#D5DCE6]/15', label: '2nd' },
	3: { text: 'text-[#E7A16B]', glow: 'from-[#E7A16B]/15', label: '3rd' }
};

function PickChip({ pick }: { pick: PickedTeam }) {
	const ring =
		pick.gameStatus === 'in_progress'
			? 'ring-live/70'
			: pick.gameStatus === 'final'
				? pick.isCorrect
					? 'ring-accent'
					: 'ring-accent-2/80'
				: 'ring-white/15';
	return (
		<div className={cn('relative h-9 w-9 rounded-full bg-gradient-to-b from-white/[0.14] to-white/[0.04] p-1.5 ring-2', ring, pick.gameStatus === 'final' && pick.isCorrect === false && 'opacity-50')} title={pick.team}>
			<Image src={pick.logo} alt={pick.abbreviation} width={28} height={28} className='h-full w-full object-contain' unoptimized />
			{pick.gameStatus === 'in_progress' && <span className='live-dot absolute -right-0.5 -top-0.5' />}
		</div>
	);
}

function LeagueCard({
	league,
	summary,
	isCommissioner,
	index,
	matchup,
	userId
}: {
	league: DashboardLeague;
	summary?: LeagueSummary;
	isCommissioner: boolean;
	index: number;
	matchup?: MatchupMiniData;
	userId?: string;
}) {
	const rank = summary?.rank ?? null;
	const rankStyle = rank ? RANK_STYLES[rank] : undefined;

	const copyInvite = async () => {
		if (!league.inviteCode) return;
		try {
			await navigator.clipboard.writeText(`${window.location.origin}/league/join/${league.inviteCode}`);
			toast.success('Invite link copied', { description: 'Send it to the group chat.' });
		} catch {
			toast.error('Couldn’t copy the link');
		}
	};

	return (
		<div className='group relative animate-slide-up' style={{ animationDelay: `${index * 60}ms` }}>
			<Link
				href={`/league/${league._id}`}
				className='glass card-hover relative flex flex-col gap-4 overflow-hidden rounded-2xl p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5'
			>
				{rankStyle && <div className={cn('pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r to-transparent', rankStyle.glow)} />}

				{/* Rank */}
				<div className='relative flex items-center gap-4 sm:w-24 sm:shrink-0 sm:flex-col sm:items-start sm:gap-0'>
					{summary?.survivor ? (
						<>
							<span className='eyebrow hidden sm:block'>Survivor</span>
							<span className={cn('grid h-14 w-14 place-items-center rounded-2xl sm:h-16 sm:w-16', summary.survivor.alive ? 'bg-accent/15 text-accent' : 'bg-accent-2/15 text-accent-2')}>
								{summary.survivor.champion ? <Crown className='h-8 w-8 text-[#FFD66B]' /> : summary.survivor.alive ? <HeartPulse className='h-8 w-8' /> : <Skull className='h-8 w-8' />}
							</span>
							<span className='text-xs text-muted-foreground sm:mt-1'>{summary.survivor.aliveCount} of {summary.totalMembers} left</span>
						</>
					) : summary ? (
						<>
							<span className='eyebrow hidden sm:block'>Rank</span>
							<span className={cn('font-display text-5xl font-extrabold italic leading-none tabular sm:text-6xl', rankStyle?.text ?? 'text-foreground')}>
								{rank ? `#${rank}` : '—'}
							</span>
							<span className='text-xs text-muted-foreground sm:mt-1'>of {summary.totalMembers}</span>
						</>
					) : (
						<Skeleton className='h-14 w-20' />
					)}
				</div>

				{/* Info */}
				<div className='relative min-w-0 flex-1'>
					<div className='flex items-center gap-2'>
						<h3 className='truncate font-display text-2xl font-bold uppercase italic leading-none tracking-tight transition-colors group-hover:text-primary'>{league.name}</h3>
						{rank === 1 && <Crown className='h-4 w-4 shrink-0 text-[#FFD66B]' />}
					</div>
					<div className='mt-2 flex flex-wrap items-center gap-2'>
						<Pill tone={league.mode === 'steve' ? 'accent' : league.mode === 'survivor' ? 'hot' : 'primary'}>{league.mode === 'steve' ? 'Steve mode' : league.mode === 'survivor' ? 'Survivor' : 'Standard'}</Pill>
						{summary &&
							(!summary.survivor || (summary.survivor.alive && !summary.survivor.complete)) &&
							(summary.hasPicks ? (
								<Pill tone='accent'>
									<CheckCircle2 className='h-3 w-3' /> Picks in
								</Pill>
							) : (
								<Pill tone='warning'>
									<Clock className='h-3 w-3' /> Picks needed
								</Pill>
							))}
						<span className='flex items-center gap-1 text-xs text-muted-foreground'>
							<Users className='h-3.5 w-3.5' />
							{league.members?.length ?? summary?.totalMembers ?? 0}
						</span>
					</div>

					{summary && summary.pickedTeams.length > 0 && (
						<div className='mt-3 flex flex-wrap items-center gap-1.5'>
							{summary.pickedTeams.map((pick, i) => (
								<PickChip key={`${pick.abbreviation}-${i}`} pick={pick} />
							))}
							{league.mode === 'steve' && summary.tfsPoints > 0 && <Pill tone='warning'>+{summary.tfsPoints} TFS</Pill>}
						</div>
					)}

					{matchup && userId && <MatchupMini data={matchup} userId={userId} />}
				</div>

				{/* Points */}
				<div className='relative flex items-end justify-between gap-4 border-t border-white/[0.06] pt-3 sm:block sm:border-0 sm:pt-0 sm:text-right'>
					{summary?.survivor ? (
						<div>
							<p className='eyebrow'>Status</p>
							<p className={cn('font-display text-3xl font-extrabold italic leading-none', summary.survivor.alive ? 'text-accent' : 'text-accent-2')}>
								{summary.survivor.champion ? 'Champion' : summary.survivor.alive ? (summary.survivor.complete ? 'Survived' : 'Alive') : `Out wk ${summary.survivor.eliminatedWeek}`}
							</p>
						</div>
					) : summary ? (
						<>
							<div>
								<p className='eyebrow'>Season</p>
								<p className='font-display text-4xl font-extrabold italic leading-none tabular'>
									{summary.seasonPoints}
									<span className='ml-1 text-sm font-semibold not-italic text-muted-foreground'>pts</span>
								</p>
							</div>
							<p className={cn('text-xs font-bold tabular sm:mt-1', summary.weekPoints > 0 ? 'text-accent' : 'text-muted-foreground')}>
								{summary.weekPoints > 0 ? `+${summary.weekPoints}` : '0'} this week
							</p>
						</>
					) : (
						<Skeleton className='h-12 w-24' />
					)}
				</div>

				<ArrowUpRight className='absolute right-4 top-4 hidden h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block' />
			</Link>

			{isCommissioner && league.inviteCode && (
				<div className='absolute right-2 top-2 sm:right-10 sm:top-3'>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button type='button' className='grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground' aria-label='League options'>
								<MoreHorizontal className='h-4 w-4' />
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align='end'>
							<DropdownMenuItem onClick={copyInvite}>
								<LinkIcon className='text-muted-foreground' />
								Copy invite link
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			)}
		</div>
	);
}

export default function ActiveLeagues({
	leagues,
	summaries,
	userId,
	matchups
}: {
	leagues: DashboardLeague[];
	summaries: Map<string, LeagueSummary>;
	userId?: string;
	/** Viewer's head-to-head matchup per league id (optional) */
	matchups?: Map<string, MatchupMiniData>;
}) {
	return (
		<div className='grid gap-3'>
			{leagues.map((league, i) => (
				<LeagueCard
					key={league._id}
					league={league}
					summary={summaries.get(league._id)}
					isCommissioner={!!userId && league.creatorId === userId}
					index={i}
					matchup={matchups?.get(league._id)}
					userId={userId}
				/>
			))}
		</div>
	);
}
