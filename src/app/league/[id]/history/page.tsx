'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import { ArrowLeft, Trophy, Medal, Award, TrendingUp, Calendar, Users } from 'lucide-react';

interface PlayerSeasonStats {
	userId: string;
	userName: string;
	userImage: string | null;
	rank: number;
	totalPoints: number;
	correctPicks: number;
	totalPicks: number;
	tfsPoints: number;
	weeksWon: number;
	winPercentage: number;
	weeklyStats: Array<{
		week: number;
		points: number;
		correctPicks: number;
		totalPicks: number;
		tfsPoints: number;
	}>;
}

interface SeasonHistory {
	leagueId: string;
	leagueName: string;
	leagueMode: string;
	seasonYear: number;
	standings: PlayerSeasonStats[];
	champions: Array<{
		userId: string;
		userName: string;
		totalPoints: number;
	}>;
	seasonStats: {
		totalWeeksPlayed: number;
		totalGamesPlayed: number;
		totalPicksMade: number;
		highestWeeklyScore?: {
			userId: string;
			userName: string;
			week: number;
			points: number;
		};
	};
	archivedAt: string;
}

interface League {
	name: string;
	sport: string;
	mode: string;
}

export default function LeagueHistoryPage() {
	const params = useParams();
	const leagueId = (params?.id as string) || '';
	const router = useRouter();
	const { data: session } = useSession();
	const [league, setLeague] = useState<League | null>(null);
	const [history, setHistory] = useState<SeasonHistory[]>([]);
	const [selectedSeason, setSelectedSeason] = useState<SeasonHistory | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch league details
	useEffect(() => {
		const fetchLeague = async () => {
			try {
				const response = await fetch(`/api/league/${leagueId}`);
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

		if (leagueId) {
			fetchLeague();
		}
	}, [leagueId, router]);

	// Fetch league history
	useEffect(() => {
		const fetchHistory = async () => {
			if (!leagueId) return;

			try {
				setLoading(true);
				const response = await fetch(`/api/league/history?leagueId=${leagueId}`);
				if (response.ok) {
					const data = await response.json();
					setHistory(data);
					if (data.length > 0) {
						setSelectedSeason(data[0]); // Select most recent season by default
					}
				} else {
					const errorData = await response.json();
					setError(errorData.error || 'Failed to fetch history');
				}
			} catch (err) {
				setError('Failed to fetch league history');
				console.error('Error fetching history:', err);
			} finally {
				setLoading(false);
			}
		};

		fetchHistory();
	}, [leagueId]);

	const getRankDisplay = (rank: number) => {
		if (rank === 1) return { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-500/20' };
		if (rank === 2) return { icon: Medal, color: 'text-gray-400', bg: 'bg-gray-400/20' };
		if (rank === 3) return { icon: Award, color: 'text-amber-600', bg: 'bg-amber-600/20' };
		return { icon: null, color: 'text-muted-foreground', bg: '' };
	};

	if (loading) {
		return (
			<div className='flex items-center justify-center h-[calc(100vh-4rem)]'>
				<Spinner />
			</div>
		);
	}

	if (error) {
		return (
			<div className='container mx-auto px-4 py-8'>
				<Card className='p-8 text-center'>
					<p className='text-red-500 mb-4'>{error}</p>
					<Button onClick={() => router.back()}>Go Back</Button>
				</Card>
			</div>
		);
	}

	return (
		<div className='container mx-auto px-4 py-8'>
			{/* Header */}
			<Card className='mb-8 bg-card border-2 border-primary/20'>
				<div className='flex flex-col md:flex-row md:items-center md:justify-between p-4 md:p-6 gap-4'>
					<div className='flex items-center gap-4 md:gap-8'>
						<Button
							variant='ghost'
							size='sm'
							onClick={() => router.push(`/league/${leagueId}`)}
							className='h-10 w-10 p-0 hover:bg-primary/10 transition-colors rounded-full'
						>
							<ArrowLeft className='h-5 w-5 text-primary' />
						</Button>
						<div className='relative w-16 h-16 md:w-24 md:h-24 flex-shrink-0'>
							<Image src='/pick-5-logo.png' alt='Pick 5 Logo' fill sizes='(max-width: 768px) 64px, 96px' className='object-contain' priority />
						</div>
						<div>
							<h1 className='text-xl md:text-2xl font-oswald uppercase tracking-wide text-primary'>{league?.name || 'League'}</h1>
							<p className='text-sm md:text-base text-primary/80 font-medium mt-1'>Season History</p>
						</div>
					</div>
				</div>
			</Card>

			{history.length === 0 ? (
				<Card className='p-8 text-center'>
					<Calendar className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
					<h2 className='text-xl font-semibold mb-2'>No Season History Yet</h2>
					<p className='text-muted-foreground mb-4'>
						Season history will appear here after the first season is completed and archived.
					</p>
					<Button onClick={() => router.push(`/league/${leagueId}`)}>Back to League</Button>
				</Card>
			) : (
				<div className='grid grid-cols-1 lg:grid-cols-4 gap-8'>
					{/* Season Selector */}
					<div className='lg:col-span-1'>
						<Card className='p-4'>
							<h2 className='text-lg font-oswald uppercase tracking-wide text-primary mb-4'>Seasons</h2>
							<div className='space-y-2'>
								{history.map((season) => (
									<button
										key={season.seasonYear}
										onClick={() => setSelectedSeason(season)}
										className={`w-full p-3 rounded-lg text-left transition-all ${
											selectedSeason?.seasonYear === season.seasonYear
												? 'bg-primary text-black font-semibold'
												: 'bg-card hover:bg-primary/10 border border-primary/20'
										}`}
									>
										<div className='flex items-center justify-between'>
											<span className='font-oswald'>{season.seasonYear}-{season.seasonYear + 1}</span>
											{selectedSeason?.seasonYear === season.seasonYear && (
												<Trophy className='h-4 w-4' />
											)}
										</div>
										<p className={`text-xs mt-1 ${
											selectedSeason?.seasonYear === season.seasonYear ? 'text-black/70' : 'text-muted-foreground'
										}`}>
											Champion: {season.champions[0]?.userName || 'TBD'}
										</p>
									</button>
								))}
							</div>
						</Card>
					</div>

					{/* Season Details */}
					{selectedSeason && (
						<div className='lg:col-span-3 space-y-6'>
							{/* Champion Card */}
							<Card className='p-6 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-2 border-yellow-500/30'>
								<div className='flex items-center gap-4'>
									<div className='p-3 bg-yellow-500/20 rounded-full'>
										<Trophy className='h-8 w-8 text-yellow-500' />
									</div>
									<div>
										<p className='text-sm text-muted-foreground'>Season Champion</p>
										<h2 className='text-2xl font-oswald uppercase tracking-wide text-yellow-500'>
											{selectedSeason.champions.map(c => c.userName).join(', ')}
										</h2>
										<p className='text-lg font-semibold text-foreground'>
											{selectedSeason.champions[0]?.totalPoints} points
										</p>
									</div>
								</div>
							</Card>

							{/* Season Stats */}
							<div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
								<Card className='p-4 text-center'>
									<Calendar className='h-6 w-6 mx-auto text-primary mb-2' />
									<p className='text-2xl font-bold text-foreground'>{selectedSeason.seasonStats.totalWeeksPlayed}</p>
									<p className='text-xs text-muted-foreground'>Weeks Played</p>
								</Card>
								<Card className='p-4 text-center'>
									<Users className='h-6 w-6 mx-auto text-primary mb-2' />
									<p className='text-2xl font-bold text-foreground'>{selectedSeason.standings.length}</p>
									<p className='text-xs text-muted-foreground'>Players</p>
								</Card>
								<Card className='p-4 text-center'>
									<TrendingUp className='h-6 w-6 mx-auto text-primary mb-2' />
									<p className='text-2xl font-bold text-foreground'>{selectedSeason.seasonStats.totalPicksMade}</p>
									<p className='text-xs text-muted-foreground'>Total Picks</p>
								</Card>
								{selectedSeason.seasonStats.highestWeeklyScore && (
									<Card className='p-4 text-center'>
										<Award className='h-6 w-6 mx-auto text-primary mb-2' />
										<p className='text-2xl font-bold text-foreground'>{selectedSeason.seasonStats.highestWeeklyScore.points}</p>
										<p className='text-xs text-muted-foreground'>
											Best Week ({selectedSeason.seasonStats.highestWeeklyScore.userName})
										</p>
									</Card>
								)}
							</div>

							{/* Standings */}
							<Card className='p-6'>
								<Tabs defaultValue='standings'>
									<TabsList className='w-full bg-muted grid grid-cols-2 p-1 mb-4'>
										<TabsTrigger value='standings' className='data-[state=active]:bg-primary data-[state=active]:text-black font-oswald uppercase tracking-wide'>
											Final Standings
										</TabsTrigger>
										<TabsTrigger value='details' className='data-[state=active]:bg-primary data-[state=active]:text-black font-oswald uppercase tracking-wide'>
											Player Details
										</TabsTrigger>
									</TabsList>

									<TabsContent value='standings'>
										<div className='space-y-2'>
											{selectedSeason.standings.map((player) => {
												const rankInfo = getRankDisplay(player.rank);
												const RankIcon = rankInfo.icon;

												return (
													<div
														key={player.userId}
														className={`flex items-center justify-between p-4 rounded-lg ${
															player.rank <= 3 ? rankInfo.bg : 'bg-card/50'
														} border border-primary/10`}
													>
														<div className='flex items-center gap-4'>
															<div className={`w-8 h-8 flex items-center justify-center rounded-full ${rankInfo.bg || 'bg-muted'}`}>
																{RankIcon ? (
																	<RankIcon className={`h-4 w-4 ${rankInfo.color}`} />
																) : (
																	<span className='text-sm font-bold text-muted-foreground'>#{player.rank}</span>
																)}
															</div>
															<div className='relative w-10 h-10 rounded-full overflow-hidden bg-primary/20'>
																{player.userImage ? (
																	<Image
																		src={player.userImage}
																		alt={player.userName}
																		fill
																		className='object-cover'
																	/>
																) : (
																	<div className='w-full h-full flex items-center justify-center text-primary font-semibold'>
																		{player.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
																	</div>
																)}
															</div>
															<div>
																<p className={`font-semibold ${player.userId === session?.user?.id ? 'text-primary' : 'text-foreground'}`}>
																	{player.userName}
																	{player.userId === session?.user?.id && ' (You)'}
																</p>
																<p className='text-xs text-muted-foreground'>
																	{player.weeksWon} week{player.weeksWon !== 1 ? 's' : ''} won
																</p>
															</div>
														</div>
														<div className='text-right'>
															<p className='text-xl font-bold text-primary'>{player.totalPoints}</p>
															<p className='text-xs text-muted-foreground'>
																{player.winPercentage}% win rate
															</p>
														</div>
													</div>
												);
											})}
										</div>
									</TabsContent>

									<TabsContent value='details'>
										<div className='space-y-4'>
											{selectedSeason.standings.map((player) => (
												<Card key={player.userId} className='p-4 border border-primary/10'>
													<div className='flex items-center justify-between mb-4'>
														<div className='flex items-center gap-3'>
															<div className='relative w-10 h-10 rounded-full overflow-hidden bg-primary/20'>
																{player.userImage ? (
																	<Image
																		src={player.userImage}
																		alt={player.userName}
																		fill
																		className='object-cover'
																	/>
																) : (
																	<div className='w-full h-full flex items-center justify-center text-primary font-semibold'>
																		{player.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
																	</div>
																)}
															</div>
															<div>
																<p className={`font-semibold ${player.userId === session?.user?.id ? 'text-primary' : 'text-foreground'}`}>
																	{player.userName}
																</p>
																<p className='text-xs text-muted-foreground'>Rank #{player.rank}</p>
															</div>
														</div>
														<div className='text-right'>
															<p className='text-lg font-bold text-primary'>{player.totalPoints} pts</p>
														</div>
													</div>

													<div className='grid grid-cols-4 gap-2 text-center text-sm'>
														<div className='p-2 bg-muted rounded'>
															<p className='font-bold text-foreground'>{player.correctPicks}/{player.totalPicks}</p>
															<p className='text-xs text-muted-foreground'>Picks</p>
														</div>
														<div className='p-2 bg-muted rounded'>
															<p className='font-bold text-foreground'>{player.winPercentage}%</p>
															<p className='text-xs text-muted-foreground'>Win %</p>
														</div>
														<div className='p-2 bg-muted rounded'>
															<p className='font-bold text-foreground'>{player.weeksWon}</p>
															<p className='text-xs text-muted-foreground'>Weeks Won</p>
														</div>
														<div className='p-2 bg-muted rounded'>
															<p className='font-bold text-foreground'>{player.tfsPoints}</p>
															<p className='text-xs text-muted-foreground'>TFS Pts</p>
														</div>
													</div>
												</Card>
											))}
										</div>
									</TabsContent>
								</Tabs>
							</Card>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
