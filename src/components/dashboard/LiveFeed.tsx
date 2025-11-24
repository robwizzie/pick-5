'use client';

import { useRouter } from 'next/navigation';
import { Calendar, Flame, Trophy, Users, Zap, TrendingUp, Target, Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import { useEffect, useState } from 'react';

interface TeamPick {
	team: string;
	logo: string;
	isCorrect: boolean | null;
	gameStatus: 'scheduled' | 'in_progress' | 'final';
}

interface FeedItem {
	type: 'pick' | 'live_game' | 'achievement' | 'league_activity' | 'milestone';
	message: string;
	timestamp: Date;
	leagueId?: string;
	leagueName?: string;
	teamPicks?: TeamPick[];
	week?: number;
	icon?: 'picks' | 'live' | 'trophy' | 'users' | 'fire' | 'zap' | 'trending' | 'target' | 'award';
	color?: string;
}

interface LiveFeedProps {
	recentActivity: Array<{
		type: 'pick' | 'league_join';
		message: string;
		timestamp: Date;
		leagueId?: string;
		leagueName?: string;
		teamPicks?: TeamPick[];
		week?: number;
	}>;
}

export default function LiveFeed({ recentActivity }: LiveFeedProps) {
	const router = useRouter();
	const [feedItems, setFeedItems] = useState<FeedItem[]>([]);

	useEffect(() => {
		// Convert recent activity to feed items
		const convertedItems: FeedItem[] = recentActivity.map(activity => ({
			type: activity.type === 'league_join' ? 'league_activity' : activity.type,
			message: activity.message,
			timestamp: activity.timestamp,
			leagueId: activity.leagueId,
			leagueName: activity.leagueName,
			teamPicks: activity.teamPicks,
			week: activity.week,
			icon: activity.type === 'pick' ? 'picks' : 'users',
			color: activity.type === 'pick' ? 'primary' : 'green-400'
		}));

		// TODO: Add more feed item types (live games, achievements, etc.)
		// For now, we'll use the existing activity and add some placeholder items for variety

		// Add some example feed items for demonstration
		const additionalItems: FeedItem[] = [];

		// Check if there are any in-progress games
		const hasLiveGames = recentActivity.some(
			activity => activity.teamPicks?.some(pick => pick.gameStatus === 'in_progress')
		);

		if (hasLiveGames) {
			additionalItems.push({
				type: 'live_game',
				message: 'Live games in progress!',
				timestamp: new Date(),
				icon: 'live',
				color: 'green-400'
			});
		}

		// Check for perfect weeks (all picks correct)
		recentActivity.forEach(activity => {
			if (activity.teamPicks && activity.teamPicks.length > 0) {
				const allCorrect = activity.teamPicks.every(pick => pick.isCorrect === true);
				const anyFinal = activity.teamPicks.some(pick => pick.gameStatus === 'final');

				if (allCorrect && anyFinal && activity.teamPicks.length === 5) {
					additionalItems.push({
						type: 'achievement',
						message: `Perfect week in ${activity.leagueName}! 🎯`,
						timestamp: activity.timestamp,
						leagueId: activity.leagueId,
						leagueName: activity.leagueName,
						icon: 'trophy',
						color: 'yellow-400'
					});
				}
			}
		});

		// Combine and sort all items
		const allItems = [...convertedItems, ...additionalItems]
			.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
			.slice(0, 15); // Show top 15 items

		setFeedItems(allItems);
	}, [recentActivity]);

	const getIcon = (icon: string = 'picks') => {
		const iconClass = 'h-4 w-4';

		switch (icon) {
			case 'live':
				return <Zap className={iconClass} />;
			case 'trophy':
				return <Trophy className={iconClass} />;
			case 'users':
				return <Users className={iconClass} />;
			case 'fire':
				return <Flame className={iconClass} />;
			case 'zap':
				return <Zap className={iconClass} />;
			case 'trending':
				return <TrendingUp className={iconClass} />;
			case 'target':
				return <Target className={iconClass} />;
			case 'award':
				return <Award className={iconClass} />;
			default:
				return <Calendar className={iconClass} />;
		}
	};

	const getColorClass = (color: string = 'primary') => {
		const colorMap: Record<string, string> = {
			'primary': 'bg-primary text-black',
			'green-400': 'bg-green-400 text-black',
			'yellow-400': 'bg-yellow-400 text-black',
			'blue-400': 'bg-blue-400 text-black',
			'red-400': 'bg-red-400 text-black',
			'purple-400': 'bg-purple-400 text-black',
			'orange-400': 'bg-orange-400 text-black'
		};

		return colorMap[color] || colorMap['primary'];
	};

	const formatTimestamp = (timestamp: Date) => {
		const now = new Date();
		const diff = now.getTime() - new Date(timestamp).getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return new Date(timestamp).toLocaleDateString();
	};

	return (
		<Card className='glass border-white/10'>
			<CardHeader>
				<CardTitle className='text-lg font-display font-semibold flex items-center gap-2'>
					<Zap className='h-5 w-5 text-primary' />
					Live Feed
				</CardTitle>
			</CardHeader>
			<CardContent className='space-y-2'>
				{feedItems.length > 0 ? (
					feedItems.map((item, index) => (
						<div
							key={index}
							className='group flex items-start gap-3 p-3 rounded-lg bg-card/50 hover:bg-card/80 transition-all duration-200 cursor-pointer hover:scale-[1.02]'
							onClick={() => item.leagueId && router.push(`/league/${item.leagueId}`)}
						>
							<div className={`p-2 rounded-full flex-shrink-0 ${getColorClass(item.color)}`}>
								{getIcon(item.icon)}
							</div>
							<div className='flex-1 min-w-0'>
								<p className='text-sm text-foreground font-medium'>{item.message}</p>
								{item.leagueName && (
									<p className='text-xs text-muted-foreground truncate'>{item.leagueName}</p>
								)}
								{item.teamPicks && item.teamPicks.length > 0 && (
									<div className='flex items-center gap-1.5 mt-2 flex-wrap'>
										{item.teamPicks.map((pick, pickIndex) => {
											// Determine background color based on game status and result
											let bgClass = 'bg-white/10 border-white/20';
											if (pick.gameStatus === 'in_progress') {
												bgClass = 'bg-blue-400/30 border-blue-400/50';
											} else if (pick.gameStatus === 'final') {
												if (pick.isCorrect === true) {
													bgClass = 'bg-green-500/30 border-green-500/50';
												} else if (pick.isCorrect === false) {
													bgClass = 'bg-red-500/30 border-red-500/50';
												}
											}

											return (
												<div
													key={pickIndex}
													className={`w-7 h-7 relative rounded-md p-0.5 border ${bgClass} transition-all duration-200 group-hover:scale-110`}
												>
													<Image
														src={pick.logo}
														alt={pick.team}
														width={28}
														height={28}
														className='rounded-sm object-contain'
														unoptimized
													/>
												</div>
											);
										})}
									</div>
								)}
								<p className='text-xs text-muted-foreground mt-1.5'>{formatTimestamp(item.timestamp)}</p>
							</div>
						</div>
					))
				) : (
					<div className='text-center py-12 text-muted-foreground'>
						<Zap className='h-8 w-8 mx-auto mb-3 opacity-50' />
						<p className='text-sm font-medium'>No activity yet</p>
						<p className='text-xs mt-1'>Make your picks to see updates here!</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
