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
import { SeasonStats } from '@/components/games/SeasonStats';
import { Leaderboard } from '@/components/games/Leaderboard';
import { Spinner } from '@/components/ui/spinner';
import Image from 'next/image';
import { Share2, Copy, Check, Info } from 'lucide-react';

interface League {
	name: string;
	sport: string;
	mode: string;
	creatorId?: string;
}

export default function LeagueDetails() {
	const params = useParams();
	const id = (params?.id as string) || '';
	const [league, setLeague] = useState<League | null>(null);
	const router = useRouter();
	const { data: session } = useSession();
	const [showInviteModal, setShowInviteModal] = useState(false);
	const [showRulesModal, setShowRulesModal] = useState(false);
	const [inviteUrl, setInviteUrl] = useState('');
	const [copied, setCopied] = useState(false);
	const [loadingInvite, setLoadingInvite] = useState(false);

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
				<div className='flex items-center justify-between p-6 gap-8'>
					<div className='flex items-center gap-8'>
						<div className='relative w-24 h-24 flex-shrink-0'>
							<Image src='/pick-5-logo.png' alt='Pick 5 Logo' fill sizes='96px' className='object-contain' priority />
						</div>
						<div>
							<h1 className='text-2xl font-oswald uppercase tracking-wide text-primary'>{league.name}</h1>
							<p className='text-primary/80 font-medium mt-1'>{league.sport}</p>
						</div>
					</div>
					<div className='flex items-center gap-2'>
						<Button onClick={() => setShowRulesModal(true)} variant='outline' className='flex items-center gap-2 border-primary/50 hover:bg-primary/10'>
							<Info className='h-4 w-4' />
							Rules
						</Button>
						{isCommissioner && (
							<Button onClick={handleGetInviteLink} disabled={loadingInvite} variant='outline' className='flex items-center gap-2 border-primary/50 hover:bg-primary/10'>
								<Share2 className='h-4 w-4' />
								Invite Link
							</Button>
						)}
					</div>
				</div>
			</Card>

			<div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
				<div className='lg:col-span-2 space-y-8'>
					<Tabs defaultValue='picks'>
						<TabsList className='w-full bg-muted grid grid-cols-2 p-1'>
							<TabsTrigger value='picks' className='data-[state=active]:bg-primary data-[state=active]:text-black font-oswald uppercase tracking-wide'>
								Make Picks
							</TabsTrigger>
							<TabsTrigger value='results' className='data-[state=active]:bg-primary data-[state=active]:text-black font-oswald uppercase tracking-wide'>
								View Results
							</TabsTrigger>
						</TabsList>
						<TabsContent value='picks'>
							<WeeklyPicks />
						</TabsContent>
						<TabsContent value='results'>
							<Results />
						</TabsContent>
					</Tabs>
				</div>
				<div className='space-y-8'>
					<SeasonStats />
					<Leaderboard />
				</div>
			</div>

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
											<span>Points earned are based on moneyline odds - underdogs earn more points!</span>
										</li>
									</ul>
								</div>

								<div className='space-y-3'>
									<h3 className='text-lg font-semibold text-primary'>Scoring System</h3>
									<div className='p-4 rounded-lg bg-card border border-primary/20 space-y-3'>
										<p className='text-sm text-muted-foreground'>Points are calculated based on betting odds. Higher risk = Higher reward!</p>

										<div className='space-y-2 text-sm'>
											<p className='font-semibold text-foreground'>Examples:</p>
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
														<span className='text-foreground'>Underdog at <span className='text-primary font-semibold'>+200</span>: Win = <span className='text-primary font-semibold'>3 points</span></span>
														<p className='text-xs text-muted-foreground mt-0.5'>Higher risk, higher reward</p>
													</div>
												</li>
												<li className='flex items-start gap-2'>
													<span className='text-primary font-bold'>•</span>
													<div>
														<span className='text-foreground'>Big underdog at <span className='text-primary font-semibold'>+400+</span>: Win = <span className='text-primary font-semibold'>5 points</span></span>
														<p className='text-xs text-muted-foreground mt-0.5'>Maximum risk, maximum reward</p>
													</div>
												</li>
											</ul>
										</div>

										<div className='border-t border-primary/20 pt-3'>
											<p className='text-sm font-semibold text-foreground mb-2'>Point Formula:</p>
											<ul className='space-y-1 text-xs text-muted-foreground'>
												<li>• <span className='text-foreground'>Favorites</span> (negative odds): Base points scaled down</li>
												<li>• <span className='text-foreground'>Underdogs</span> (positive odds): Base points scaled up</li>
												<li>• <span className='text-foreground'>Wrong pick</span>: 0 points</li>
											</ul>
										</div>
									</div>
									<div className='p-3 rounded-lg bg-primary/10 border border-primary/20'>
										<p className='text-sm text-foreground'>
											<strong>Strategy:</strong> Balance safe picks with underdog risks to maximize your weekly score!
										</p>
									</div>
								</div>

								<div className='space-y-3'>
									<h3 className='text-lg font-semibold text-primary'>Strategy Tips</h3>
									<ul className='space-y-2 text-sm text-muted-foreground'>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Mix favorites with underdogs to balance risk and reward</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Picking all favorites is safe but yields fewer points than mixing in underdogs</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>One successful underdog pick can outscore multiple favorite picks</span>
										</li>
										<li className='flex gap-2'>
											<span className='text-primary font-bold'>•</span>
											<span>Check the odds displayed on each game to see potential points before picking</span>
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
		</div>
	);
}
