'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { WeeklyPicks } from '@/components/games/WeeklyPicks';
import { Results } from '@/components/games/Results';
import { Leaderboard } from '@/components/games/Leaderboard';
import { Recap } from '@/components/games/Recap';
import { Spinner } from '@/components/ui/spinner';
import LeagueStats from '@/components/league/LeagueStats';
import Image from 'next/image';
import { Share2, Copy, Check, Info, LogOut, Gamepad2, Trophy, BarChart3, TrendingUp, Sparkles, Settings, UserMinus, Eye, EyeOff } from 'lucide-react';
import { useWeek } from '@/contexts/WeekContext';
import { NFLService } from '@/services/nflService';

interface League {
	name: string;
	sport: string;
	mode: string;
	creatorId?: string;
}

interface Member {
	_id: string;
	name: string;
	image: string | null;
}

export default function LeagueDetails() {
	const params = useParams();
	const id = (params?.id as string) || '';
	const [league, setLeague] = useState<League | null>(null);
	const router = useRouter();
	const { data: session } = useSession();
	const { currentWeek } = useWeek();
	const [showInviteModal, setShowInviteModal] = useState(false);
	const [showRulesModal, setShowRulesModal] = useState(false);
	const [showLeaveModal, setShowLeaveModal] = useState(false);
	const [showSettingsModal, setShowSettingsModal] = useState(false);
	const [inviteUrl, setInviteUrl] = useState('');
	const [copied, setCopied] = useState(false);
	const [loadingInvite, setLoadingInvite] = useState(false);
	const [loadingLeave, setLoadingLeave] = useState(false);
	const [loadingSettings, setLoadingSettings] = useState(false);
	const [newLeagueName, setNewLeagueName] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [members, setMembers] = useState<Member[]>([]);
	const [loadingMembers, setLoadingMembers] = useState(false);
	const [settingsTab, setSettingsTab] = useState<'general' | 'members'>('general');
	const [mobileView, setMobileView] = useState<'picks' | 'results' | 'leaderboard' | 'stats' | 'recap'>('picks');
	const [hasRecapData, setHasRecapData] = useState(false);
	const [actualCurrentWeek, setActualCurrentWeek] = useState<number | null>(null);
	const [recapWeekToShow, setRecapWeekToShow] = useState<number | null>(null);

	// Fetch league details
	useEffect(() => {
		const fetchLeague = async () => {
			try {
				const response = await fetch(`/api/league/${id}`);
				if (response.ok) {
					const data = await response.json();
					setLeague(data);
				} else {
					router.replace('/dashboard');
				}
			} catch {
				router.replace('/dashboard');
			}
		};

		fetchLeague();
	}, [id, router]);

	// Get actual NFL current week
	useEffect(() => {
		const fetchActualWeek = async () => {
			try {
				const week = await NFLService.getCurrentWeek();
				setActualCurrentWeek(week);
			} catch (error) {
				console.error('Error fetching current week:', error);
			}
		};
		fetchActualWeek();
	}, []);

	// Check if "Last Week's Recap" should be shown
	// Show it when viewing the ACTUAL current week AND previous week has recap data
	useEffect(() => {
		const checkRecapAvailability = async () => {
			if (!id || !currentWeek || !actualCurrentWeek) return;

			// Are we viewing the actual current NFL week?
			const viewingCurrentWeek = currentWeek === actualCurrentWeek;

			if (viewingCurrentWeek && currentWeek > 1) {
				// Check if last week has recap data
				const previousWeek = currentWeek - 1;
				try {
					const response = await fetch(`/api/recap?week=${previousWeek}&leagueId=${id}`, { cache: 'no-store' });
					if (response.ok) {
						const data = await response.json();
						const hasData = data.hasPicks && data.weekCompleted;
						setHasRecapData(hasData);
						if (hasData) {
							setRecapWeekToShow(previousWeek);
						}
					} else {
						setHasRecapData(false);
						setRecapWeekToShow(null);
					}
				} catch {
					setHasRecapData(false);
					setRecapWeekToShow(null);
				}
			} else {
				// Not viewing current week, don't show recap
				setHasRecapData(false);
				setRecapWeekToShow(null);
			}
		};

		checkRecapAvailability();
		// Re-check every 2 minutes in case week completes
		const interval = setInterval(checkRecapAvailability, 120000);
		return () => clearInterval(interval);
	}, [id, currentWeek, actualCurrentWeek]);

	const handleGetInviteLink = async () => {
		try {
			setLoadingInvite(true);
			const response = await fetch(`/api/league/${id}/invite-link`);
			if (response.ok) {
				const data = await response.json();
				setInviteUrl(data.inviteUrl);
				setShowInviteModal(true);
			}
		} catch (error) {
			console.error('Error fetching invite link:', error);
		} finally {
			setLoadingInvite(false);
		}
	};

	const handleCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(inviteUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (error) {
			console.error('Error copying to clipboard:', error);
		}
	};

	const handleLeaveLeague = async () => {
		try {
			setLoadingLeave(true);
			const response = await fetch(`/api/league/${id}/leave`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			if (response.ok) {
				// Redirect to dashboard after leaving
				router.push('/dashboard');
			} else {
				const data = await response.json();
				alert(data.error || 'Failed to leave league');
			}
		} catch (error) {
			console.error('Error leaving league:', error);
			alert('Failed to leave league');
		} finally {
			setLoadingLeave(false);
			setShowLeaveModal(false);
		}
	};

	const handleOpenSettings = async () => {
		setNewLeagueName(league?.name || '');
		setNewPassword('');
		setShowPassword(false);
		setSettingsTab('general');
		setShowSettingsModal(true);

		// Fetch members
		await fetchMembers();
	};

	const fetchMembers = async () => {
		try {
			setLoadingMembers(true);
			const response = await fetch(`/api/league/${id}/members`);
			if (response.ok) {
				const data = await response.json();
				setMembers(data);
			}
		} catch (error) {
			console.error('Error fetching members:', error);
		} finally {
			setLoadingMembers(false);
		}
	};

	const handleRemoveMember = async (userId: string) => {
		if (!confirm('Are you sure you want to remove this member? This will delete all their picks in this league.')) {
			return;
		}

		try {
			const response = await fetch(`/api/league/${id}/members`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId })
			});

			if (response.ok) {
				// Refresh members list
				await fetchMembers();
			} else {
				const data = await response.json();
				alert(data.error || 'Failed to remove member');
			}
		} catch (error) {
			console.error('Error removing member:', error);
			alert('Failed to remove member');
		}
	};

	const handleSaveSettings = async () => {
		try {
			setLoadingSettings(true);

			const updateData: { name?: string; password?: string } = {};

			if (newLeagueName !== league?.name) {
				updateData.name = newLeagueName;
			}

			if (newPassword.trim()) {
				updateData.password = newPassword;
			}

			// Only make request if there are changes
			if (Object.keys(updateData).length === 0) {
				setShowSettingsModal(false);
				return;
			}

			const response = await fetch(`/api/league/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updateData)
			});

			if (response.ok) {
				const data = await response.json();
				setLeague(data.league);
				setShowSettingsModal(false);
				if (newPassword.trim()) {
					alert('League settings updated successfully! New password is now active.');
				}
			} else {
				const data = await response.json();
				alert(data.error || 'Failed to update league settings');
			}
		} catch (error) {
			console.error('Error updating league settings:', error);
			alert('Failed to update league settings');
		} finally {
			setLoadingSettings(false);
		}
	};

	// Check if current user is the commissioner
	const isCommissioner = league && session?.user?.id && league.creatorId === session.user.id;

	if (!league) {
		return (
			<div className='flex items-center justify-center h-[calc(100vh-4rem)]'>
				<Spinner />
			</div>
		);
	}

	return (
		<div className='container mx-auto px-4 py-8'>
			<Card className='mb-8 bg-card border-2 border-primary/20'>
				<div className='flex flex-col md:flex-row md:items-center md:justify-between p-4 md:p-6 gap-4'>
					<div className='flex items-center gap-4 md:gap-8'>
						<div className='relative w-16 h-16 md:w-24 md:h-24 flex-shrink-0'>
							<Image src='/pick-5-logo.png' alt='Pick 5 Logo' fill sizes='(max-width: 768px) 64px, 96px' className='object-contain' priority />
						</div>
						<div>
							<div className='flex items-center gap-2'>
								<h1 className='text-xl md:text-2xl font-oswald uppercase tracking-wide text-primary'>{league.name}</h1>
								{isCommissioner && (
									<Button onClick={handleOpenSettings} variant='ghost' size='sm' className='h-8 w-8 p-0 hover:bg-primary/10' title='League Settings'>
										<Settings className='h-4 w-4 text-primary' />
									</Button>
								)}
							</div>
							<p className='text-sm md:text-base text-primary/80 font-medium mt-1'>{league.sport}</p>
						</div>
					</div>
					<div className='flex items-center gap-2 flex-shrink-0'>
						<Button onClick={() => setShowRulesModal(true)} variant='outline' className='flex items-center gap-1.5 md:gap-2 border-primary/50 hover:bg-primary/10 text-sm md:text-base px-3 md:px-4'>
							<Info className='h-3.5 w-3.5 md:h-4 md:w-4' />
							<span className='hidden sm:inline'>Rules</span>
							<span className='sm:hidden'>Info</span>
						</Button>
						{!isCommissioner && (
							<Button onClick={() => setShowLeaveModal(true)} variant='outline' className='flex items-center gap-1.5 md:gap-2 border-red-500/50 hover:bg-red-500/10 text-red-500 text-sm md:text-base px-3 md:px-4'>
								<LogOut className='h-3.5 w-3.5 md:h-4 md:w-4' />
								<span className='hidden sm:inline'>Leave League</span>
								<span className='sm:hidden'>Leave</span>
							</Button>
						)}
						{isCommissioner && (
							<Button onClick={handleGetInviteLink} disabled={loadingInvite} variant='outline' className='flex items-center gap-1.5 md:gap-2 border-primary/50 hover:bg-primary/10 text-sm md:text-base px-3 md:px-4'>
								<Share2 className='h-3.5 w-3.5 md:h-4 md:w-4' />
								<span className='hidden sm:inline'>Invite Link</span>
								<span className='sm:hidden'>Share</span>
							</Button>
						)}
					</div>
				</div>
			</Card>

			{/* Desktop Layout - Keep current tab design */}
			<div className='hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-8'>
				<div className='lg:col-span-2 space-y-8'>
					<Tabs defaultValue='picks'>
						<TabsList className={`w-full bg-muted grid p-1 ${hasRecapData ? 'grid-cols-3' : 'grid-cols-2'}`}>
							<TabsTrigger value='picks' className='data-[state=active]:bg-primary data-[state=active]:text-black font-oswald uppercase tracking-wide'>
								Make Picks
							</TabsTrigger>
							<TabsTrigger value='results' className='data-[state=active]:bg-primary data-[state=active]:text-black font-oswald uppercase tracking-wide'>
								View Results
							</TabsTrigger>
							{hasRecapData && (
								<TabsTrigger value='recap' className='data-[state=active]:bg-primary data-[state=active]:text-black font-oswald uppercase tracking-wide'>
									Last Week&apos;s Recap
								</TabsTrigger>
							)}
						</TabsList>
						<TabsContent value='picks'>
							<WeeklyPicks />
						</TabsContent>
						<TabsContent value='results'>
							<Results />
						</TabsContent>
						{hasRecapData && recapWeekToShow && (
							<TabsContent value='recap'>
								<Recap weekOverride={recapWeekToShow} />
							</TabsContent>
						)}
					</Tabs>
				</div>
				<div className='space-y-8'>
					<LeagueStats leagueId={id} userId={session?.user?.id} leagueName={league.name} />
					<Leaderboard />
				</div>
			</div>

			{/* Mobile Layout - Bottom Navigation */}
			<div className='lg:hidden pb-24'>
				{mobileView === 'picks' && <WeeklyPicks />}
				{mobileView === 'results' && <Results />}
				{mobileView === 'leaderboard' && <Leaderboard />}
				{mobileView === 'stats' && <LeagueStats leagueId={id} userId={session?.user?.id} leagueName={league.name} />}
				{hasRecapData && recapWeekToShow && mobileView === 'recap' && <Recap weekOverride={recapWeekToShow} />}
			</div>

			{/* Mobile Bottom Navigation Bar - Liquid Glass Segmented Control */}
			<nav className='lg:hidden fixed bottom-4 left-4 right-4 z-50'>
				<div className='mx-auto max-w-2xl bg-black/30 backdrop-blur-3xl border border-white/20 rounded-full p-2 shadow-2xl shadow-black/40'>
					<div className={`grid gap-1.5 relative ${hasRecapData ? 'grid-cols-5' : 'grid-cols-4'}`}>
						<button
							onClick={() => setMobileView('picks')}
							className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-full transition-all duration-300 ${
								mobileView === 'picks'
									? 'bg-primary/90 backdrop-blur-xl shadow-lg shadow-primary/30'
									: 'hover:bg-white/10 active:scale-95'
							}`}
						>
							<Gamepad2 className={`h-5 w-5 transition-all duration-300 ${mobileView === 'picks' ? 'text-black' : 'text-muted-foreground'}`} />
							<span className={`text-[10px] font-bold mt-0.5 transition-all duration-300 ${
								mobileView === 'picks' ? 'text-black' : 'text-muted-foreground'
							}`}>
								Picks
							</span>
						</button>

						<button
							onClick={() => setMobileView('results')}
							className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-full transition-all duration-300 ${
								mobileView === 'results'
									? 'bg-primary/90 backdrop-blur-xl shadow-lg shadow-primary/30'
									: 'hover:bg-white/10 active:scale-95'
							}`}
						>
							<BarChart3 className={`h-5 w-5 transition-all duration-300 ${mobileView === 'results' ? 'text-black' : 'text-muted-foreground'}`} />
							<span className={`text-[10px] font-bold mt-0.5 transition-all duration-300 ${
								mobileView === 'results' ? 'text-black' : 'text-muted-foreground'
							}`}>
								Results
							</span>
						</button>

						<button
							onClick={() => setMobileView('leaderboard')}
							className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-full transition-all duration-300 ${
								mobileView === 'leaderboard'
									? 'bg-primary/90 backdrop-blur-xl shadow-lg shadow-primary/30'
									: 'hover:bg-white/10 active:scale-95'
							}`}
						>
							<Trophy className={`h-5 w-5 transition-all duration-300 ${mobileView === 'leaderboard' ? 'text-black' : 'text-muted-foreground'}`} />
							<span className={`text-[10px] font-bold mt-0.5 transition-all duration-300 ${
								mobileView === 'leaderboard' ? 'text-black' : 'text-muted-foreground'
							}`}>
								Board
							</span>
						</button>

						<button
							onClick={() => setMobileView('stats')}
							className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-full transition-all duration-300 ${
								mobileView === 'stats'
									? 'bg-primary/90 backdrop-blur-xl shadow-lg shadow-primary/30'
									: 'hover:bg-white/10 active:scale-95'
							}`}
						>
							<TrendingUp className={`h-5 w-5 transition-all duration-300 ${mobileView === 'stats' ? 'text-black' : 'text-muted-foreground'}`} />
							<span className={`text-[10px] font-bold mt-0.5 transition-all duration-300 ${
								mobileView === 'stats' ? 'text-black' : 'text-muted-foreground'
							}`}>
								Stats
							</span>
						</button>

						{hasRecapData && (
							<button
								onClick={() => setMobileView('recap')}
								className={`relative flex flex-col items-center justify-center py-3 px-2 rounded-full transition-all duration-300 ${
									mobileView === 'recap'
										? 'bg-primary/90 backdrop-blur-xl shadow-lg shadow-primary/30'
										: 'hover:bg-white/10 active:scale-95'
								}`}
							>
								<Sparkles className={`h-5 w-5 transition-all duration-300 ${mobileView === 'recap' ? 'text-black' : 'text-muted-foreground'}`} />
								<span className={`text-[10px] font-bold mt-0.5 transition-all duration-300 ${
									mobileView === 'recap' ? 'text-black' : 'text-muted-foreground'
								}`}>
									Recap
								</span>
							</button>
						)}
					</div>
				</div>
			</nav>

			{/* Invite Link Modal */}
			<Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
				<DialogContent className='glass border-white/10 backdrop-blur-xl sm:max-w-md'>
					<DialogHeader>
						<DialogTitle className='text-2xl font-bold text-primary'>Share Invite Link</DialogTitle>
						<DialogDescription className='text-muted-foreground'>Share this link with friends to invite them to join {league.name}</DialogDescription>
					</DialogHeader>

					<div className='space-y-4 py-4'>
						<div className='space-y-2'>
							<label className='text-sm font-medium text-foreground'>Invite Link</label>
							<div className='flex gap-2'>
								<Input value={inviteUrl} readOnly className='glass border-white/10 bg-background/50 font-mono text-sm' />
								<Button onClick={handleCopyLink} className='bg-primary hover:bg-primary/90 flex items-center gap-2 min-w-[100px]'>
									{copied ? (
										<>
											<Check className='h-4 w-4' />
											Copied!
										</>
									) : (
										<>
											<Copy className='h-4 w-4' />
											Copy
										</>
									)}
								</Button>
							</div>
						</div>

						<div className='p-4 rounded-lg bg-primary/10 border border-primary/20'>
							<p className='text-sm text-muted-foreground'>
								<strong className='text-foreground'>How it works:</strong> Anyone with this link can join your league instantly after logging in or creating an
								account. No password needed!
							</p>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Rules Modal */}
			<Dialog open={showRulesModal} onOpenChange={setShowRulesModal}>
				<DialogContent className='glass border-white/10 backdrop-blur-xl sm:max-w-2xl max-h-[80vh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle className='text-2xl font-bold text-primary'>League Rules & Scoring</DialogTitle>
						<DialogDescription className='text-muted-foreground'>
							{league.mode === 'steve' ? 'Steve Mode - Pick 5 with TFS Bonus' : 'Standard Mode - Moneyline-Based Scoring'}
						</DialogDescription>
					</DialogHeader>

					<div className='space-y-6 py-4'>
						{league.mode === 'steve' ? (
							// Steve Mode Rules (Simple picks + TFS)
							<>
								<div className='space-y-3'>
									<h3 className='text-lg font-semibold text-primary'>How to Play</h3>
									<ul className='space-y-2 text-sm text-muted-foreground'>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Each week, select exactly 5 games from the available matchups</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Pick which team you think will win each game</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Predict the Total Final Score (TFS) for one designated game</span>
										</li>
									</ul>
								</div>

								<div className='space-y-3'>
									<h3 className='text-lg font-semibold text-primary'>Scoring System</h3>
									<div className='p-4 rounded-lg bg-card border border-primary/20 space-y-4'>
										<div>
											<p className='text-sm font-semibold text-foreground mb-2'>Regular Picks (5 games):</p>
											<ul className='space-y-2 text-sm'>
												<li className='flex items-center justify-between'>
													<span className='text-foreground'>Each correct pick:</span>
													<span className='font-bold text-primary'>2 points</span>
												</li>
												<li className='flex items-center justify-between'>
													<span className='text-foreground'>Each incorrect pick:</span>
													<span className='font-bold text-muted-foreground'>0 points</span>
												</li>
												<li className='flex items-center justify-between border-t border-primary/20 pt-2 mt-2'>
													<span className='text-foreground'>Maximum from picks:</span>
													<span className='font-bold text-primary'>10 points</span>
												</li>
											</ul>
										</div>

										<div className='border-t border-primary/20 pt-4'>
											<p className='text-sm font-semibold text-foreground mb-2'>Total Final Score (TFS) Bonus:</p>
											<ul className='space-y-2 text-sm'>
												<li className='flex items-center justify-between'>
													<span className='text-foreground'>Exact score:</span>
													<span className='font-bold text-primary'>5 points</span>
												</li>
												<li className='flex items-center justify-between'>
													<span className='text-foreground'>Within 1-3 points:</span>
													<span className='font-bold text-primary'>4 points</span>
												</li>
												<li className='flex items-center justify-between'>
													<span className='text-foreground'>Within 4-5 points:</span>
													<span className='font-bold text-primary'>3 points</span>
												</li>
												<li className='flex items-center justify-between'>
													<span className='text-foreground'>Within 6-7 points:</span>
													<span className='font-bold text-primary'>2 points</span>
												</li>
												<li className='flex items-center justify-between'>
													<span className='text-foreground'>Within 8-10 points:</span>
													<span className='font-bold text-primary'>1 point</span>
												</li>
												<li className='flex items-center justify-between'>
													<span className='text-foreground'>More than 10 points off:</span>
													<span className='font-bold text-muted-foreground'>0 points</span>
												</li>
											</ul>
										</div>
									</div>
									<div className='p-3 rounded-lg bg-primary/10 border border-primary/20'>
										<p className='text-sm text-foreground'>
											<strong>Maximum Weekly Score:</strong> 15 points (10 from picks + 5 from TFS)
										</p>
									</div>
								</div>

								<div className='space-y-3'>
									<h3 className='text-lg font-semibold text-primary'>Strategy Tips</h3>
									<ul className='space-y-2 text-muted-foreground text-sm'>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Pick games you feel most confident about to maximize your correct picks</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>The TFS prediction can be a tiebreaker - research both teams&apos; scoring trends</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Even if you&apos;re off on the exact TFS, you can still earn partial points</span>
										</li>
									</ul>
								</div>
							</>
						) : (
							// Standard Mode Rules (Moneyline-based)
							<>
								<div className='space-y-3'>
									<h3 className='text-lg font-semibold text-primary'>How to Play</h3>
									<ul className='space-y-2 text-sm text-muted-foreground'>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Each week, select exactly 5 games from the available matchups</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Pick which team you think will win each game</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Points are based on moneyline odds - bigger underdogs earn WAY more points!</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Every correct pick earns at least 1 point (all whole numbers, no decimals)</span>
										</li>
									</ul>
								</div>

								<div className='space-y-3'>
									<h3 className='text-lg font-semibold text-primary'>Scoring System</h3>
									<div className='p-4 rounded-lg bg-card border border-primary/20 space-y-3'>
										<p className='text-sm text-muted-foreground'>Points are based on betting odds. Bigger underdogs = WAY bigger rewards! All values are whole numbers, minimum 1 point per correct pick.</p>

										<div className='space-y-2 text-sm'>
											<p className='font-semibold text-foreground'>Point Examples:</p>
											<ul className='space-y-2'>
												<li className='flex items-start gap-2'>
													<span className='text-primary font-bold'>•</span>
													<div>
														<span className='text-foreground'>Favorite at <span className='text-primary font-semibold'>-200</span>: Win = <span className='text-primary font-semibold'>1 point</span></span>
														<p className='text-xs text-muted-foreground mt-0.5'>Low risk, lower reward</p>
													</div>
												</li>
												<li className='flex items-start gap-2'>
													<span className='text-primary font-bold'>•</span>
													<div>
														<span className='text-foreground'>Even odds <span className='text-primary font-semibold'>+100/-100</span>: Win = <span className='text-primary font-semibold'>2 points</span></span>
														<p className='text-xs text-muted-foreground mt-0.5'>Balanced matchup</p>
													</div>
												</li>
												<li className='flex items-start gap-2'>
													<span className='text-primary font-bold'>•</span>
													<div>
														<span className='text-foreground'>Underdog at <span className='text-primary font-semibold'>+200</span>: Win = <span className='text-primary font-semibold'>4 points</span></span>
														<p className='text-xs text-muted-foreground mt-0.5'>Higher risk, higher reward</p>
													</div>
												</li>
												<li className='flex items-start gap-2'>
													<span className='text-primary font-bold'>•</span>
													<div>
														<span className='text-foreground'>Medium underdog at <span className='text-primary font-semibold'>+300</span>: Win = <span className='text-primary font-semibold'>6 points</span></span>
														<p className='text-xs text-muted-foreground mt-0.5'>Risky pick, great reward</p>
													</div>
												</li>
												<li className='flex items-start gap-2'>
													<span className='text-primary font-bold'>•</span>
													<div>
														<span className='text-foreground'>Big underdog at <span className='text-primary font-semibold'>+400</span>: Win = <span className='text-primary font-semibold'>8 points</span></span>
														<p className='text-xs text-muted-foreground mt-0.5'>High risk, high reward</p>
													</div>
												</li>
												<li className='flex items-start gap-2'>
													<span className='text-primary font-bold'>•</span>
													<div>
														<span className='text-foreground'>Longshot at <span className='text-primary font-semibold'>+1000+</span>: Win = <span className='text-primary font-semibold'>20-30 points</span></span>
														<p className='text-xs text-muted-foreground mt-0.5'>Extreme risk, game-changing reward!</p>
													</div>
												</li>
											</ul>
										</div>

										<div className='border-t border-primary/20 pt-3'>
											<p className='text-sm font-semibold text-foreground mb-2'>Scoring Details:</p>
											<ul className='space-y-1 text-xs text-muted-foreground'>
												<li>• <span className='text-foreground'>All points are whole numbers</span> - no fractions or decimals</li>
												<li>• <span className='text-foreground'>Minimum 1 point</span> for any correct pick</li>
												<li>• <span className='text-foreground'>Maximum 30 points</span> for extreme longshot underdogs</li>
												<li>• <span className='text-foreground'>Wrong pick</span>: 0 points</li>
											</ul>
										</div>
									</div>
									<div className='p-3 rounded-lg bg-primary/10 border border-primary/20'>
										<p className='text-sm text-foreground'>
											<strong>Strategy:</strong> One big underdog win (+600) can be worth 12 favorite picks! High-risk plays can completely change your standings.
										</p>
									</div>
								</div>

								<div className='space-y-3'>
									<h3 className='text-lg font-semibold text-primary'>Strategy Tips</h3>
									<ul className='space-y-2 text-sm text-muted-foreground'>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Playing all favorites is safe but limits you to ~5-10 points per week maximum</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>One successful +300 underdog (6 pts) is worth 6 heavy favorite picks (1 pt each)</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Mix 2-3 safe picks with 2-3 underdogs to maximize your upside potential</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>The odds and exact point values are shown on each game card before you pick</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Look for undervalued underdogs - sometimes a +300 team has a real chance to win!</span>
										</li>
									</ul>
								</div>
							</>
						)}

						<div className='p-4 rounded-lg bg-card border border-primary/20'>
							<h3 className='text-sm font-semibold text-foreground mb-2'>Important Notes</h3>
							<ul className='space-y-2 text-xs text-muted-foreground'>
								<li className='flex gap-2'>
									<span className='text-primary font-bold'>•</span>
									<span>All picks must be submitted before the first game of the week starts</span>
								</li>
								<li className='flex gap-2'>
									<span className='text-primary font-bold'>•</span>
									<span>You can edit your picks until the deadline</span>
								</li>
								<li className='flex gap-2'>
									<span className='text-primary font-bold'>•</span>
									<span>Points are calculated automatically after all games in the week are completed</span>
								</li>
								<li className='flex gap-2'>
									<span className='text-primary font-bold'>•</span>
									<span>Season standings are based on total points accumulated throughout the season</span>
								</li>
							</ul>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Leave League Confirmation Modal */}
			<Dialog open={showLeaveModal} onOpenChange={setShowLeaveModal}>
				<DialogContent className='glass border-white/10 backdrop-blur-xl sm:max-w-md'>
					<DialogHeader>
						<DialogTitle className='text-2xl font-bold text-red-500'>Leave League?</DialogTitle>
						<DialogDescription className='text-muted-foreground'>
							Are you sure you want to leave {league.name}? This action cannot be undone.
						</DialogDescription>
					</DialogHeader>
					<div className='space-y-4 py-4'>
						<div className='p-4 rounded-lg bg-red-500/10 border border-red-500/20'>
							<p className='text-sm text-foreground'>
								<strong>Warning:</strong> Leaving this league will:
							</p>
							<ul className='text-sm text-muted-foreground mt-2 space-y-1'>
								<li>• Remove you from all league standings</li>
								<li>• Delete all your picks for this league</li>
								<li>• You&apos;ll need an invite link to rejoin</li>
							</ul>
						</div>
						<div className='flex gap-3'>
							<Button
								onClick={() => setShowLeaveModal(false)}
								variant='outline'
								className='flex-1'
								disabled={loadingLeave}>
								Cancel
							</Button>
							<Button
								onClick={handleLeaveLeague}
								className='flex-1 bg-red-500 hover:bg-red-600 text-white'
								disabled={loadingLeave}>
								{loadingLeave ? 'Leaving...' : 'Leave League'}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* League Settings Modal */}
			<Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
				<DialogContent className='glass border-white/10 backdrop-blur-xl sm:max-w-2xl max-h-[80vh] overflow-y-auto w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:w-full sm:max-w-2xl'>
					<DialogHeader>
						<DialogTitle className='text-2xl font-bold text-primary'>League Settings</DialogTitle>
						<DialogDescription className='text-muted-foreground'>
							Manage your league settings and members. Only commissioners can modify these settings.
						</DialogDescription>
					</DialogHeader>

					<Tabs value={settingsTab} onValueChange={(value) => setSettingsTab(value as 'general' | 'members')} className='w-full'>
						<TabsList className='grid w-full grid-cols-2 mb-4'>
							<TabsTrigger value='general'>General</TabsTrigger>
							<TabsTrigger value='members'>Members ({members.length})</TabsTrigger>
						</TabsList>

						<TabsContent value='general' className='space-y-4'>
							<div className='space-y-2'>
								<label className='text-sm font-medium text-foreground'>League Name</label>
								<Input
									value={newLeagueName}
									onChange={(e) => setNewLeagueName(e.target.value)}
									placeholder='Enter league name'
									className='glass border-white/10 bg-background/50'
									maxLength={100}
								/>
								<p className='text-xs text-muted-foreground'>{newLeagueName.length}/100 characters</p>
							</div>

							<div className='space-y-2'>
								<label className='text-sm font-medium text-foreground'>League Password</label>
								<div className='relative'>
									<Input
										type={showPassword ? 'text' : 'password'}
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
										placeholder='Enter new password (leave empty to keep current)'
										className='glass border-white/10 bg-background/50 pr-10'
										maxLength={50}
									/>
									<Button
										type='button'
										variant='ghost'
										size='sm'
										className='absolute right-0 top-0 h-full px-3 hover:bg-transparent'
										onClick={() => setShowPassword(!showPassword)}>
										{showPassword ? <EyeOff className='h-4 w-4 text-muted-foreground' /> : <Eye className='h-4 w-4 text-muted-foreground' />}
									</Button>
								</div>
								<p className='text-xs text-muted-foreground'>
									{newPassword ? `${newPassword.length}/50 characters - Password must be at least 4 characters` : 'Leave empty to keep current password'}
								</p>
							</div>

							<div className='space-y-2'>
								<label className='text-sm font-medium text-foreground'>League Mode</label>
								<div className='p-3 rounded-lg bg-card border border-primary/20'>
									<p className='text-sm text-foreground font-semibold'>{league.mode === 'steve' ? 'Steve Mode' : 'Standard Mode'}</p>
									<p className='text-xs text-muted-foreground mt-1'>League mode cannot be changed after creation</p>
								</div>
							</div>

							<div className='flex gap-3 pt-4'>
								<Button
									onClick={() => setShowSettingsModal(false)}
									variant='outline'
									className='flex-1'
									disabled={loadingSettings}>
									Cancel
								</Button>
								<Button
									onClick={handleSaveSettings}
									className='flex-1 bg-primary hover:bg-primary/90 text-black'
									disabled={loadingSettings || !newLeagueName.trim() || (newPassword.trim().length > 0 && newPassword.trim().length < 4)}>
									{loadingSettings ? 'Saving...' : 'Save Changes'}
								</Button>
							</div>
						</TabsContent>

						<TabsContent value='members' className='space-y-4'>
							{loadingMembers ? (
								<div className='flex justify-center py-8'>
									<Spinner />
								</div>
							) : (
								<>
									<div className='p-3 rounded-lg bg-card border border-primary/20'>
										<p className='text-sm text-foreground'>
											<strong>Total Members:</strong> {members.length}
										</p>
										<p className='text-xs text-muted-foreground mt-1'>
											Remove members to clean up inactive users. Their picks will be permanently deleted.
										</p>
									</div>

									<div className='space-y-2 max-h-96 overflow-y-auto'>
										{members.map((member) => {
											const isCommissionerMember = member._id === league.creatorId;
											return (
												<div key={member._id} className='flex items-center justify-between p-3 rounded-lg bg-card/50 border border-primary/10'>
													<div className='flex items-center gap-3'>
														<div className='relative w-10 h-10 rounded-full overflow-hidden bg-primary/20'>
															{member.image ? (
																<Image
																	src={member.image}
																	alt={member.name}
																	fill
																	className='object-cover'
																/>
															) : (
																<div className='w-full h-full flex items-center justify-center text-primary font-semibold'>
																	{member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
																</div>
															)}
														</div>
														<div>
															<p className='text-sm font-medium text-foreground flex items-center gap-2'>
																{member.name}
																{isCommissionerMember && (
																	<span className='text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold'>
																		Commissioner
																	</span>
																)}
															</p>
														</div>
													</div>
													{!isCommissionerMember && (
														<Button
															onClick={() => handleRemoveMember(member._id)}
															variant='ghost'
															size='sm'
															className='text-red-500 hover:text-red-600 hover:bg-red-500/10'>
															<UserMinus className='h-4 w-4' />
														</Button>
													)}
												</div>
											);
										})}
									</div>

									<div className='flex justify-end pt-4'>
										<Button onClick={() => setShowSettingsModal(false)} variant='outline'>
											Close
										</Button>
									</div>
								</>
							)}
						</TabsContent>
					</Tabs>
				</DialogContent>
			</Dialog>
		</div>
	);
}
