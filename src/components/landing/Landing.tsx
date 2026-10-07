'use client';

import Image from 'next/image';
import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { FcGoogle } from 'react-icons/fc';
import { ArrowRight, Check, Crown, Flame, Target, TrendingUp, Trophy, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const AUTH_ERRORS: Record<string, string> = {
	OAuthAccountNotLinked: 'That email is already linked to another sign-in method.',
	AccessDenied: 'Access was denied. Please try again.',
	Callback: 'Something went wrong finishing sign-in. Please try again.',
	SessionRequired: 'Please sign in to continue.'
};

// The real odds → points scale (see src/utils/oddsUtils.ts)
const SCALE = [
	{ odds: '-200', pts: 1, label: 'Heavy fav' },
	{ odds: 'EVEN', pts: 2, label: "Pick 'em" },
	{ odds: '+200', pts: 4, label: 'Underdog' },
	{ odds: '+300', pts: 6, label: 'Big dog' },
	{ odds: '+500', pts: 10, label: 'Long shot' },
	{ odds: '+1000', pts: 20, label: 'Moon shot' }
];

const TICKER = ['Underdog +320 → 6 pts', 'Five picks a week', 'Upsets pay big', 'Beat your group chat', 'Live scores', 'Season-long bragging rights', 'Moon shot +1000 → 20 pts', 'Weekly recaps'];

// Illustrative card for the hero — not real data
const DEMO_PICKS = [
	{ away: 'NYJ', home: 'BUF', pick: 'NYJ', odds: '+310', pts: 6, result: true },
	{ away: 'DAL', home: 'PHI', pick: 'PHI', odds: '-180', pts: 2, result: true },
	{ away: 'KC', home: 'LV', pick: 'KC', odds: '-260', pts: 1, result: true },
	{ away: 'SF', home: 'SEA', pick: 'SEA', odds: '+135', pts: 3, result: false },
	{ away: 'DET', home: 'GB', pick: 'GB', odds: '+105', pts: 3, result: null }
];

function GoogleButton({ onClick, loading, className }: { onClick: () => void; loading: boolean; className?: string }) {
	return (
		<Button size='xl' onClick={onClick} disabled={loading} className={cn('bg-white text-[#0b0d12] shadow-[0_12px_40px_-12px_rgba(255,255,255,0.45)] hover:bg-white hover:brightness-100 hover:shadow-[0_16px_50px_-12px_rgba(255,255,255,0.6)]', className)}>
			<FcGoogle className='!size-5' />
			{loading ? 'Opening Google…' : 'Continue with Google'}
			<ArrowRight className='opacity-60 transition-transform group-hover:translate-x-0.5' />
		</Button>
	);
}

function HeroCard() {
	const total = DEMO_PICKS.reduce((sum, p) => sum + (p.result ? p.pts : 0), 0);
	return (
		<div className='relative mx-auto w-full max-w-sm'>
			{/* Logo floats behind the card */}
			<div className='pointer-events-none absolute -right-2 -top-32 z-10 w-32 animate-float sm:-right-12 sm:-top-40 sm:w-44'>
				<div className='absolute inset-0 rounded-full bg-primary/30 blur-3xl' />
				<Image src='/pick-5-logo.webp' alt='Pick 5' width={520} height={594} priority className='relative h-auto w-full drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]' />
			</div>

			<div className='gradient-border glass-strong relative rounded-3xl p-4 sm:p-5'>
				<div className='mb-4 flex items-center justify-between'>
					<div>
						<p className='eyebrow'>Your card</p>
						<p className='font-display text-2xl font-extrabold uppercase italic leading-none'>Week 6</p>
					</div>
					<div className='text-right'>
						<p className='eyebrow'>Points</p>
						<p className='font-display text-4xl font-extrabold italic leading-none text-accent tabular'>+{total}</p>
					</div>
				</div>
				<ul className='space-y-2'>
					{DEMO_PICKS.map((p, i) => (
						<li
							key={p.away}
							className={cn(
								'flex animate-slide-up items-center gap-3 rounded-xl border px-3 py-2.5',
								p.result === true && 'border-accent/30 bg-accent/[0.07]',
								p.result === false && 'border-accent-2/25 bg-accent-2/[0.06]',
								p.result === null && 'border-live/30 bg-live/[0.05]'
							)}
							style={{ animationDelay: `${300 + i * 90}ms` }}
						>
							<span
								className={cn(
									'grid h-6 w-6 shrink-0 place-items-center rounded-full',
									p.result === true ? 'bg-accent text-accent-foreground' : p.result === false ? 'bg-accent-2 text-white' : 'bg-transparent'
								)}
							>
								{p.result === true ? <Check className='h-3.5 w-3.5' strokeWidth={3} /> : p.result === false ? <X className='h-3.5 w-3.5' strokeWidth={3} /> : <span className='live-dot' />}
							</span>
							<span className='font-display text-lg font-bold uppercase italic leading-none tracking-tight'>
								<span className={p.pick === p.away ? 'text-foreground' : 'text-muted-foreground/60'}>{p.away}</span>
								<span className='mx-1.5 text-sm text-muted-foreground/50'>@</span>
								<span className={p.pick === p.home ? 'text-foreground' : 'text-muted-foreground/60'}>{p.home}</span>
							</span>
							<span className='ml-auto font-mono text-[11px] font-bold text-muted-foreground'>{p.odds}</span>
							<span className={cn('w-12 text-right font-display text-lg font-extrabold italic leading-none tabular', p.result === true ? 'text-accent' : 'text-muted-foreground/60')}>
								{p.result === null ? 'LIVE' : `+${p.result ? p.pts : 0}`}
							</span>
						</li>
					))}
				</ul>
			</div>

			{/* Floating upset chip */}
			<div className='absolute -bottom-5 -left-3 animate-slide-up sm:-left-10' style={{ animationDelay: '900ms' }}>
				<div className='flex items-center gap-2 rounded-2xl bg-brand-hot px-3.5 py-2 text-white shadow-[0_16px_40px_-10px_rgba(255,61,90,0.8)]'>
					<Flame className='h-4 w-4' />
					<span className='text-sm font-bold'>Upset! +6 pts</span>
				</div>
			</div>
		</div>
	);
}

export function Landing({ error, callbackUrl = '/dashboard' }: { error?: string; callbackUrl?: string }) {
	const [loading, setLoading] = useState(false);
	const errorMessage = error ? (AUTH_ERRORS[error] ?? 'Sign-in failed. Please try again.') : null;

	const handleSignIn = () => {
		setLoading(true);
		signIn('google', { callbackUrl });
	};

	return (
		<div className='overflow-x-clip'>
			{/* Hero */}
			<section className='mx-auto grid max-w-7xl items-center gap-16 px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.15fr_1fr] lg:gap-10 lg:px-8 lg:pb-28 lg:pt-20'>
				<div className='text-center lg:text-left'>
					<div className='mb-6 inline-flex animate-fade-in items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-xs font-semibold backdrop-blur'>
						<span className='rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground'>New season</span>
						<span className='text-muted-foreground'>Picks are open — grab your crew</span>
					</div>

					<h1 className='display-heading animate-slide-up text-[3.6rem] sm:text-8xl xl:text-[7.5rem]'>
						<span className='chrome-text block pr-2'>Five picks.</span>
						<span className='chrome-text block pr-2'>Every week.</span>
						<span className='brand-text block animate-gradient pr-3'>Bragging rights.</span>
					</h1>

					<p className='mx-auto mt-6 max-w-xl animate-slide-up text-lg text-muted-foreground sm:text-xl lg:mx-0' style={{ animationDelay: '120ms' }}>
						The weekly NFL pick’em for you and your friends. Pick five games, back the underdogs for bigger points, and climb your league’s leaderboard all season long.
					</p>

					<div className='mt-9 flex animate-slide-up flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start' style={{ animationDelay: '220ms' }}>
						<GoogleButton onClick={handleSignIn} loading={loading} className='group w-full sm:w-auto' />
						<a href='#how-it-works' className='text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground'>
							How it works ↓
						</a>
					</div>

					{errorMessage && (
						<p role='alert' className='mx-auto mt-5 max-w-md rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:mx-0'>
							{errorMessage}
						</p>
					)}

					<div className='mt-10 flex animate-fade-in items-center justify-center gap-6 text-sm text-muted-foreground lg:justify-start' style={{ animationDelay: '400ms' }}>
						<span className='flex items-center gap-2'>
							<Users className='h-4 w-4 text-primary' /> Private leagues
						</span>
						<span className='flex items-center gap-2'>
							<TrendingUp className='h-4 w-4 text-accent' /> Live scoring
						</span>
						<span className='hidden items-center gap-2 sm:flex'>
							<Trophy className='h-4 w-4 text-warning' /> Season history
						</span>
					</div>
				</div>

				<div className='animate-scale-in pt-28 lg:pt-0' style={{ animationDelay: '150ms' }}>
					<HeroCard />
				</div>
			</section>

			{/* Ticker */}
			<div className='relative -rotate-1 border-y border-white/10 bg-white/[0.03] py-3 backdrop-blur'>
				<div className='flex w-max animate-marquee gap-10 whitespace-nowrap'>
					{[...TICKER, ...TICKER].map((item, i) => (
						<span key={i} className='flex items-center gap-10 font-display text-xl font-bold uppercase italic tracking-tight text-muted-foreground'>
							{item}
							<span className='h-1.5 w-1.5 rounded-full bg-primary' />
						</span>
					))}
				</div>
			</div>

			{/* How it works */}
			<section id='how-it-works' className='mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6 lg:px-8'>
				<p className='eyebrow text-center'>How it works</p>
				<h2 className='display-heading mt-3 text-center text-5xl sm:text-6xl'>Simple to play. Hard to master.</h2>

				<div className='mt-14 grid gap-4 md:grid-cols-3'>
					{[
						{ icon: Target, step: '01', title: 'Pick five games', body: 'Each week, choose the winners of any five NFL matchups and make one your Lock for double points. Change your mind any time before kickoff.', tone: 'text-primary bg-primary/10' },
						{ icon: Flame, step: '02', title: 'Back the underdogs', body: 'Points come from the moneyline. Favorites are safe, but one upset can be worth a whole week of chalk.', tone: 'text-accent-2 bg-accent-2/10' },
						{ icon: Crown, step: '03', title: 'Climb the board', body: 'Scores update live on game day. Weekly recaps crown the winner and track who’s rising all season.', tone: 'text-accent bg-accent/10' }
					].map(({ icon: Icon, step, title, body, tone }) => (
						<div key={step} className='glass card-hover relative overflow-hidden rounded-3xl p-7'>
							<span className='pointer-events-none absolute -right-2 -top-6 font-display text-[8rem] font-extrabold italic leading-none text-white/[0.03]'>{step}</span>
							<span className={cn('grid h-12 w-12 place-items-center rounded-2xl', tone)}>
								<Icon className='h-6 w-6' />
							</span>
							<h3 className='mt-6 font-display text-3xl font-bold uppercase italic tracking-tight'>{title}</h3>
							<p className='mt-2 text-muted-foreground'>{body}</p>
						</div>
					))}
				</div>
			</section>

			{/* Points scale */}
			<section className='mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8'>
				<div className='glass-strong relative overflow-hidden rounded-3xl p-6 sm:p-10'>
					<div className='pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent-2/20 blur-3xl' />
					<div className='relative grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center'>
						<div>
							<p className='eyebrow'>Standard scoring</p>
							<h2 className='display-heading mt-3 text-5xl'>
								The bigger the dog, <span className='brand-text'>the bigger the bite.</span>
							</h2>
							<p className='mt-4 text-muted-foreground'>
								Every correct pick earns at least one point. Odds are locked in the moment you pick, so jumping on a line early can pay off. Prefer it simple? Steve Mode scores 2 per win plus a total-score tiebreaker bonus.
							</p>
						</div>
						<div className='flex h-64 items-end gap-2 sm:gap-3'>
							{SCALE.map((s, i) => (
								<div key={s.odds} className='flex h-full flex-1 flex-col items-center justify-end gap-2'>
									<span className='font-display text-2xl font-extrabold italic leading-none tabular sm:text-3xl'>{s.pts}</span>
									<div
										className='w-full origin-bottom animate-slide-up rounded-t-xl bg-gradient-to-t from-primary/30 to-primary'
										style={{
											height: `${Math.max(8, (s.pts / 20) * 100)}%`,
											animationDelay: `${i * 80}ms`,
											backgroundImage: i >= 4 ? 'linear-gradient(to top, rgba(255,61,90,0.35), #FF7A30)' : undefined
										}}
									/>
									<span className='font-mono text-[10px] font-bold text-muted-foreground sm:text-xs'>{s.odds}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>

			{/* Final CTA */}
			<section className='mx-auto max-w-3xl px-4 pb-24 text-center sm:px-6'>
				<h2 className='display-heading text-5xl sm:text-7xl'>
					<span className='chrome-text'>Your league is</span> <span className='brand-text'>waiting.</span>
				</h2>
				<p className='mx-auto mt-4 max-w-md text-muted-foreground'>Start a league in under a minute and send the invite link to the group chat.</p>
				<div className='mt-8 flex justify-center'>
					<GoogleButton onClick={handleSignIn} loading={loading} className='group' />
				</div>
			</section>

			<footer className='border-t border-white/[0.06] py-8 text-center text-xs text-muted-foreground'>
				<p>Pick 5 · For entertainment only — no real money involved. Not affiliated with the NFL.</p>
			</footer>
		</div>
	);
}
