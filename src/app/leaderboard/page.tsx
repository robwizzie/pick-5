'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, Award, Crown, TrendingUp, Users } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import CountUp from 'react-countup';
import Image from 'next/image';

interface LeaderboardEntry {
	rank: number;
	name: string;
	image: string | null;
	totalPoints: number;
	totalPicks: number;
	correctPicks: number;
	winRate: number;
	isCurrentUser: boolean;
}

export default function GlobalLeaderboard() {
	const router = useRouter();
	const { data: session, status } = useSession();
	const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [userRank, setUserRank] = useState<number | null>(null);

	useEffect(() => {
		if (status === 'unauthenticated') {
			router.push('/login');
			return;
		}
	}, [status, router]);

	useEffect(() => {
		const fetchGlobalLeaderboard = async () => {
			if (!session) return;

			try {
				setLoading(true);

				// Fetch all leagues the user is in
				const leaguesRes = await fetch('/api/user/leagues');
				if (!leaguesRes.ok) return;

				const leagues = await leaguesRes.json();
				if (leagues.length === 0) {
					setLoading(false);
					return;
				}

				// Map to aggregate user points across all leagues
				const globalUserPoints = new Map<string, {
					name: string;
					image: string | null;
					totalPoints: number;
					totalPicks: number;
					correctPicks: number;
				}>();

				// Fetch leaderboard data from all leagues
				for (const league of leagues) {
					try {
						const leaderboardRes = await fetch(`/api/leaderboard?leagueId=${league._id}`);
						if (leaderboardRes.ok) {
							const data = await leaderboardRes.json();

							// Aggregate all users' data
							if (data.seasonStats && Array.isArray(data.seasonStats)) {
								data.seasonStats.forEach((stat: {
									player: string;
									image: string | null;
									totalPoints: number;
									totalPicks: number;
									correctPicks: number;
								}) => {
									const existing = globalUserPoints.get(stat.player);
									if (existing) {
										existing.totalPoints += stat.totalPoints || 0;
										existing.totalPicks += stat.totalPicks || 0;
										existing.correctPicks += stat.correctPicks || 0;
									} else {
										globalUserPoints.set(stat.player, {
											name: stat.player,
											image: stat.image || null,
											totalPoints: stat.totalPoints || 0,
											totalPicks: stat.totalPicks || 0,
											correctPicks: stat.correctPicks || 0
										});
									}
								});
							}
						}
					} catch (error) {
						console.error('Error fetching league leaderboard:', error);
					}
				}

				// Convert to array and sort by total points
				const sortedLeaderboard = Array.from(globalUserPoints.values())
					.sort((a, b) => b.totalPoints - a.totalPoints)
					.map((user, index) => ({
						rank: index + 1,
						name: user.name,
						image: user.image,
						totalPoints: user.totalPoints,
						totalPicks: user.totalPicks,
						correctPicks: user.correctPicks,
						winRate: user.totalPicks > 0 ? Math.round((user.correctPicks / user.totalPicks) * 100) : 0,
						isCurrentUser: user.name === session.user?.name
					}));

				setLeaderboard(sortedLeaderboard);

				// Find current user's rank
				const currentUserEntry = sortedLeaderboard.find(entry => entry.isCurrentUser);
				if (currentUserEntry) {
					setUserRank(currentUserEntry.rank);
				}

				setLoading(false);
			} catch (error) {
				console.error('Error fetching global leaderboard:', error);
				setLoading(false);
			}
		};

		fetchGlobalLeaderboard();
	}, [session]);

	const getRankIcon = (rank: number) => {
		switch (rank) {
			case 1:
				return <Crown className='h-6 w-6 text-yellow-400' fill='currentColor' />;
			case 2:
				return <Medal className='h-6 w-6 text-gray-400' />;
			case 3:
				return <Award className='h-6 w-6 text-orange-400' />;
			default:
				return null;
		}
	};

	const getRankStyle = (rank: number) => {
		switch (rank) {
			case 1:
				return 'bg-gradient-to-br from-yellow-500/20 via-yellow-500/5 to-transparent border-yellow-500/30';
			case 2:
				return 'bg-gradient-to-br from-gray-400/20 via-gray-400/5 to-transparent border-gray-400/30';
			case 3:
				return 'bg-gradient-to-br from-orange-500/20 via-orange-500/5 to-transparent border-orange-500/30';
			default:
				return 'border-white/10';
		}
	};

	const getRankTextStyle = (rank: number) => {
		switch (rank) {
			case 1:
				return 'text-yellow-400';
			case 2:
				return 'text-gray-300';
			case 3:
				return 'text-orange-400';
			default:
				return 'text-primary';
		}
	};

	if (loading) {
		return (
			<div className='min-h-screen flex items-center justify-center'>
				<Spinner />
			</div>
		);
	}

	return (
		<div className='min-h-screen p-4 pt-8'>
			<div className='max-w-5xl mx-auto space-y-6'>
				{/* Header */}
				<div className='text-center space-y-4'>
					<div className='flex items-center justify-center gap-3'>
						<Trophy className='h-10 w-10 text-primary' />
						<h1 className='text-4xl lg:text-5xl font-display font-bold gradient-text'>Global Leaderboard</h1>
						<Trophy className='h-10 w-10 text-primary' />
					</div>
					<p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
						All players ranked by total season points across all leagues
					</p>
				</div>

				{/* Stats Summary */}
				<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
					<Card className='glass border-white/10'>
						<CardContent className='p-4 text-center'>
							<Users className='h-6 w-6 text-primary mx-auto mb-2' />
							<p className='text-2xl font-bold text-primary'>{leaderboard.length}</p>
							<p className='text-sm text-muted-foreground'>Total Players</p>
						</CardContent>
					</Card>
					{userRank && (
						<>
							<Card className='glass border-white/10'>
								<CardContent className='p-4 text-center'>
									<Trophy className='h-6 w-6 text-primary mx-auto mb-2' />
									<p className='text-2xl font-bold text-primary'>#{userRank}</p>
									<p className='text-sm text-muted-foreground'>Your Rank</p>
								</CardContent>
							</Card>
							<Card className='glass border-white/10'>
								<CardContent className='p-4 text-center'>
									<TrendingUp className='h-6 w-6 text-primary mx-auto mb-2' />
									<p className='text-2xl font-bold text-primary'>
										Top {Math.round(((leaderboard.length - userRank + 1) / leaderboard.length) * 100)}%
									</p>
									<p className='text-sm text-muted-foreground'>Percentile</p>
								</CardContent>
							</Card>
						</>
					)}
				</div>

				{/* Leaderboard */}
				<Card className='glass border-white/10'>
					<CardHeader>
						<CardTitle className='text-2xl font-display'>Rankings</CardTitle>
					</CardHeader>
					<CardContent className='p-0'>
						{leaderboard.length > 0 ? (
							<div className='space-y-2 p-4'>
								{leaderboard.map((entry) => (
									<div
										key={entry.name}
										className={`p-4 rounded-lg border-2 transition-all duration-300 ${getRankStyle(entry.rank)} ${
											entry.isCurrentUser ? 'ring-2 ring-primary shadow-lg' : ''
										}`}
									>
										<div className='flex items-center gap-4'>
											{/* Rank */}
											<div className='flex items-center justify-center w-12'>
												{entry.rank <= 3 ? (
													getRankIcon(entry.rank)
												) : (
													<span className={`text-2xl font-bold font-mono ${getRankTextStyle(entry.rank)}`}>
														#{entry.rank}
													</span>
												)}
											</div>

											{/* Avatar */}
											<div className='relative w-12 h-12 rounded-full overflow-hidden bg-primary/20 flex-shrink-0'>
												{entry.image ? (
													<Image
														src={entry.image}
														alt={entry.name}
														fill
														className='object-cover'
													/>
												) : (
													<div className='w-full h-full flex items-center justify-center text-primary font-semibold text-lg'>
														{entry.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
													</div>
												)}
											</div>

											{/* Name */}
											<div className='flex-1 min-w-0'>
												<p className={`font-semibold text-lg ${entry.isCurrentUser ? 'text-primary' : 'text-foreground'}`}>
													{entry.name}
													{entry.isCurrentUser && <span className='ml-2 text-xs text-primary'>(You)</span>}
												</p>
												<p className='text-sm text-muted-foreground'>
													{entry.correctPicks}/{entry.totalPicks} picks • {entry.winRate}% win rate
												</p>
											</div>

											{/* Points */}
											<div className='text-right'>
												<p className='text-3xl font-bold text-primary tabular-nums font-mono'>
													<CountUp end={entry.totalPoints} duration={0.5} />
												</p>
												<p className='text-xs text-muted-foreground'>points</p>
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className='text-center py-12 text-muted-foreground'>
								<Trophy className='h-12 w-12 mx-auto mb-4 opacity-50' />
								<p>No rankings available yet.</p>
								<p className='text-sm mt-2'>Join a league and make picks to appear on the leaderboard!</p>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
