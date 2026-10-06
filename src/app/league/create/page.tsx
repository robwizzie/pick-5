'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Eye, EyeOff, Info, Loader2, Lock, Target, TrendingUp, Trophy, type LucideIcon } from 'lucide-react';
import { FaFootballBall, FaBasketballBall, FaBaseballBall, FaHockeyPuck } from 'react-icons/fa';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PageContainer, PageHeader, Pill } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import { calculatePointsFromOdds, formatOdds } from '@/utils/oddsUtils';

// Points always come from the real scoring function
const SCORING_EXAMPLES = [
	{ label: 'Heavy favorite', odds: -300 },
	{ label: 'Favorite', odds: -150 },
	{ label: 'Even odds', odds: 100 },
	{ label: 'Underdog', odds: 200 },
	{ label: 'Big underdog', odds: 400 },
	{ label: 'Long shot', odds: 1000 }
];

type ScoringMode = 'steve' | 'standard';

const sports = [
	{ name: 'NFL', icon: FaFootballBall, available: true },
	{ name: 'NBA', icon: FaBasketballBall, available: false },
	{ name: 'MLB', icon: FaBaseballBall, available: false },
	{ name: 'NHL', icon: FaHockeyPuck, available: false }
];

const modes: Array<{
	id: ScoringMode;
	name: string;
	tagline: string;
	icon: LucideIcon;
	points: Array<{ value: string; label: string }>;
}> = [
	{
		id: 'standard',
		name: 'Standard',
		tagline: 'Moneyline-based points — underdogs pay more.',
		icon: TrendingUp,
		points: [
			{ value: '1–30', label: 'pts per win, set by the odds' },
			{ value: '+400', label: `big dog = ${calculatePointsFromOdds(400)} pts` }
		]
	},
	{
		id: 'steve',
		name: 'Steve',
		tagline: '2 pts per correct pick plus a Total Final Score bonus.',
		icon: Target,
		points: [
			{ value: '2', label: 'pts per correct pick' },
			{ value: '+5', label: 'max TFS bonus' }
		]
	}
];

export default function CreateLeaguePage() {
	const router = useRouter();
	const [selectedSport, setSelectedSport] = useState<string>('NFL');
	const [scoringMode, setScoringMode] = useState<ScoringMode | null>(null);
	const [leagueName, setLeagueName] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);
	const [touched, setTouched] = useState({ name: false, password: false });
	const [creating, setCreating] = useState(false);
	const [showModeInfo, setShowModeInfo] = useState<ScoringMode | null>(null);

	const trimmedName = leagueName.trim();
	const fieldErrors = {
		mode: !scoringMode ? 'Choose a scoring mode' : null,
		name: !trimmedName ? 'Give your league a name' : null,
		password: !password ? 'Set a password so only your crew can join' : null
	};
	const showNameError = (touched.name || submitted) && fieldErrors.name;
	const showPasswordError = (touched.password || submitted) && fieldErrors.password;

	const handleCreateLeague = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitted(true);
		setError(null);

		if (!selectedSport || fieldErrors.mode || fieldErrors.name || fieldErrors.password) {
			return;
		}

		try {
			setCreating(true);
			const response = await fetch('/api/league/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sport: selectedSport,
					scoringMode,
					name: trimmedName,
					password
				})
			});

			if (response.ok) {
				const league: { _id?: string } = await response.json().catch(() => ({}));
				router.push(league._id ? `/setup?id=${league._id}` : '/setup');
				return;
			}

			const errorData: { error?: string; message?: string } = await response.json().catch(() => ({}));
			setError(errorData.error || errorData.message || 'Failed to create league');
		} catch {
			setError('An unexpected error occurred');
		}
		setCreating(false);
	};

	return (
		<PageContainer size='narrow'>
			<PageHeader
				eyebrow={
					<>
						<Trophy className='h-3.5 w-3.5 text-primary' /> New league
					</>
				}
				title='Create a League'
				description='Pick a scoring mode, name your league and set a password. You can invite friends right after.'
				actions={
					<Button variant='ghost' size='sm' onClick={() => router.push('/dashboard')}>
						<ArrowLeft /> Back
					</Button>
				}
			/>

			<form onSubmit={handleCreateLeague} noValidate className='space-y-8'>
				{/* Sport */}
				<section className='animate-slide-up' style={{ animationDelay: '60ms' }}>
					<p className='eyebrow mb-3'>1 · Sport</p>
					<div className='grid grid-cols-4 gap-2'>
						{sports.map(sport => {
							const active = selectedSport === sport.name;
							return (
								<button
									key={sport.name}
									type='button'
									disabled={!sport.available}
									onClick={() => setSelectedSport(sport.name)}
									aria-pressed={active}
									className={cn(
										'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-sm font-semibold transition-colors',
										active ? 'border-primary/50 bg-primary/10 text-primary ring-1 ring-primary/40' : 'border-white/[0.07] bg-white/[0.03] text-foreground hover:bg-white/[0.06]',
										!sport.available && 'cursor-not-allowed opacity-40 hover:bg-white/[0.03]'
									)}
								>
									<sport.icon className='h-5 w-5' />
									{sport.name}
									{!sport.available && <span className='text-[10px] font-medium uppercase tracking-wider text-muted-foreground'>Soon</span>}
								</button>
							);
						})}
					</div>
				</section>

				{/* Scoring mode */}
				<section className='animate-slide-up' style={{ animationDelay: '120ms' }}>
					<p className='eyebrow mb-3'>2 · Scoring mode</p>
					<div role='radiogroup' aria-label='Scoring mode' className='grid gap-3 sm:grid-cols-2'>
						{modes.map(mode => {
							const active = scoringMode === mode.id;
							const Icon = mode.icon;
							return (
								<div
									key={mode.id}
									role='radio'
									aria-checked={active}
									tabIndex={0}
									onClick={() => setScoringMode(mode.id)}
									onKeyDown={e => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											setScoringMode(mode.id);
										}
									}}
									className={cn(
										'glass group relative flex cursor-pointer flex-col rounded-2xl p-5 text-left transition-all duration-200 ease-out-expo hover:-translate-y-0.5 hover:border-white/15',
										active && 'border-primary/50 bg-primary/[0.06] shadow-primary-glow ring-2 ring-primary'
									)}
								>
									<div className='flex items-start justify-between gap-3'>
										<span className={cn('grid h-11 w-11 place-items-center rounded-xl transition-colors', active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary')}>
											<Icon className='h-5 w-5' />
										</span>
										<span
											aria-hidden
											className={cn('grid h-6 w-6 place-items-center rounded-full border transition-colors', active ? 'border-primary bg-primary text-primary-foreground' : 'border-white/20')}
										>
											{active && <Check className='h-3.5 w-3.5' strokeWidth={3} />}
										</span>
									</div>
									<h3 className='mt-4 font-display text-3xl font-extrabold uppercase italic leading-none tracking-tight'>
										{mode.name} <span className='text-muted-foreground'>Mode</span>
									</h3>
									<p className='mt-2 text-sm text-muted-foreground'>{mode.tagline}</p>
									<div className='mt-4 grid grid-cols-2 gap-2'>
										{mode.points.map(p => (
											<div key={p.label} className='rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2'>
												<p className='font-display text-2xl font-extrabold italic tabular leading-none text-foreground'>{p.value}</p>
												<p className='mt-1 text-[11px] leading-tight text-muted-foreground'>{p.label}</p>
											</div>
										))}
									</div>
									<button
										type='button'
										onClick={e => {
											e.stopPropagation();
											setShowModeInfo(mode.id);
										}}
										className='mt-4 inline-flex items-center gap-1.5 self-start text-xs font-semibold text-primary hover:underline'
									>
										<Info className='h-3.5 w-3.5' /> How scoring works
									</button>
								</div>
							);
						})}
					</div>
					{submitted && fieldErrors.mode && <p className='mt-2 text-sm text-destructive'>{fieldErrors.mode}</p>}
				</section>

				{/* Details */}
				<section className='glass animate-slide-up space-y-5 rounded-2xl p-5 sm:p-6' style={{ animationDelay: '180ms' }}>
					<p className='eyebrow'>3 · League details</p>

					<div className='space-y-2'>
						<Label htmlFor='league-name'>League name</Label>
						<Input
							id='league-name'
							placeholder='e.g. Sunday Funday Degenerates'
							value={leagueName}
							onChange={e => setLeagueName(e.target.value)}
							onBlur={() => setTouched(t => ({ ...t, name: true }))}
							aria-invalid={!!showNameError}
							aria-describedby='league-name-help'
							autoComplete='off'
							className={cn(showNameError && 'border-destructive/60 focus-visible:border-destructive/60 focus-visible:ring-destructive/30')}
						/>
						<p id='league-name-help' className={cn('text-xs', showNameError ? 'text-destructive' : 'text-muted-foreground')}>
							{showNameError || 'This is how your league shows up in Browse and on invites.'}
						</p>
					</div>

					<div className='space-y-2'>
						<Label htmlFor='league-password'>League password</Label>
						<div className='relative'>
							<Lock className='pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
							<Input
								id='league-password'
								type={showPassword ? 'text' : 'password'}
								placeholder='Something your friends can remember'
								value={password}
								onChange={e => setPassword(e.target.value)}
								onBlur={() => setTouched(t => ({ ...t, password: true }))}
								aria-invalid={!!showPasswordError}
								aria-describedby='league-password-help'
								autoComplete='new-password'
								className={cn('pl-10 pr-11', showPasswordError && 'border-destructive/60 focus-visible:border-destructive/60 focus-visible:ring-destructive/30')}
							/>
							<button
								type='button'
								onClick={() => setShowPassword(s => !s)}
								aria-label={showPassword ? 'Hide password' : 'Show password'}
								className='absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:text-foreground'
							>
								{showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
							</button>
						</div>
						<p id='league-password-help' className={cn('text-xs', showPasswordError ? 'text-destructive' : 'text-muted-foreground')}>
							{showPasswordError || 'Players joining from Browse will need this. Invite links skip it.'}
						</p>
					</div>
				</section>

				{error && (
					<Alert variant='destructive' className='animate-fade-in'>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}

				<div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
					<p className='text-sm text-muted-foreground'>
						{scoringMode ? (
							<>
								Creating an <span className='font-semibold text-foreground'>{selectedSport}</span> league in{' '}
								<Pill tone='primary' className='align-middle'>
									{scoringMode === 'steve' ? 'Steve' : 'Standard'} mode
								</Pill>
							</>
						) : (
							'Select a scoring mode to continue.'
						)}
					</p>
					<Button type='submit' size='lg' variant='gradient' disabled={creating} className='w-full sm:w-auto'>
						{creating ? (
							<>
								<Loader2 className='animate-spin' /> Creating…
							</>
						) : (
							<>
								<Trophy /> Create League
							</>
						)}
					</Button>
				</div>
			</form>

			{/* Mode Info Dialog */}
			<Dialog open={showModeInfo !== null} onOpenChange={open => !open && setShowModeInfo(null)}>
				<DialogContent className='sm:max-w-lg'>
					<DialogHeader>
						<DialogTitle>{showModeInfo === 'steve' ? 'Steve Mode' : 'Standard Mode'}</DialogTitle>
						<DialogDescription>{showModeInfo === 'steve' ? 'Simple Pick 5 with TFS Bonus' : 'Moneyline-Based Scoring'}</DialogDescription>
					</DialogHeader>

					<div className='space-y-3'>
						{showModeInfo === 'steve' ? (
							<>
								<p className='text-sm text-muted-foreground'>Pick 5 winners each week plus predict a Total Final Score (TFS) for bonus points. Simple, straightforward scoring!</p>
								<InfoPanel title='Scoring'>
									<InfoRow label='Each correct pick' value='2 pts' />
									<InfoRow label='TFS accuracy bonus' value='0–5 pts' />
									<InfoRow label='Max per week (10 + 5)' value='15 pts' />
								</InfoPanel>
								<InfoPanel title='What is TFS?'>
									<p className='mb-2 text-sm text-muted-foreground'>
										<strong className='text-foreground'>Total Final Score</strong> — pick one game and predict the combined score of both teams.
									</p>
									<InfoRow label='Exact match' value='5 pts' />
									<InfoRow label='Within 3 points' value='4 pts' />
									<InfoRow label='Within 5 points' value='3 pts' />
									<InfoRow label='Within 7 points' value='2 pts' />
									<InfoRow label='Within 10 points' value='1 pt' />
								</InfoPanel>
								<BestFor>Players who want straightforward scoring without worrying about odds or risk management.</BestFor>
							</>
						) : (
							<>
								<p className='text-sm text-muted-foreground'>Pick 5 winners each week with points based on moneyline odds. Bigger underdogs = more points when you win!</p>
								<InfoPanel title='Scoring examples'>
									{SCORING_EXAMPLES.map(({ label, odds }) => {
										const pts = calculatePointsFromOdds(odds);
										return <InfoRow key={odds} label={`${label} (${formatOdds(odds)})`} value={`${pts} ${pts === 1 ? 'pt' : 'pts'}`} />;
									})}
								</InfoPanel>
								<BestFor>Players who enjoy risk/reward strategy and want to see live betting odds with each pick.</BestFor>
							</>
						)}
					</div>

					<div className='grid gap-2 sm:grid-cols-2'>
						<Button variant='outline' onClick={() => setShowModeInfo(null)}>
							Close
						</Button>
						<Button
							onClick={() => {
								if (showModeInfo) setScoringMode(showModeInfo);
								setShowModeInfo(null);
							}}
						>
							<Check /> Choose this mode
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</PageContainer>
	);
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className='rounded-xl border border-white/[0.07] bg-white/[0.03] p-4'>
			<p className='eyebrow mb-2'>{title}</p>
			<div className='space-y-1.5'>{children}</div>
		</div>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className='flex items-center justify-between gap-3 text-sm'>
			<span className='text-muted-foreground'>{label}</span>
			<span className='font-semibold tabular text-foreground'>{value}</span>
		</div>
	);
}

function BestFor({ children }: { children: React.ReactNode }) {
	return (
		<p className='rounded-xl border border-primary/25 bg-primary/[0.08] px-4 py-3 text-sm'>
			<strong className='text-primary'>Best for:</strong> {children}
		</p>
	);
}
