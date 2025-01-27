'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { WeeklyPicks } from '@/components/games/WeeklyPicks';
import { Results } from '@/components/games/Results';
import { SeasonStats } from '@/components/games/SeasonStats';
import { Leaderboard } from '@/components/games/Leaderboard';
import { Spinner } from '@/components/ui/spinner';
import Image from 'next/image';

interface League {
	name: string;
	sport: string;
}

export default function LeagueDetails({ params }: { params: Promise<{ id: string }> }) {
	const { id } = use(params);
	const [league, setLeague] = useState<League | null>(null);
	const router = useRouter();

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
				<div className='flex items-center justify-start p-6 gap-8'>
					<div className='relative w-24 h-24 flex-shrink-0'>
						<Image src='/pick-5-logo.png' alt='Pick 5 Logo' fill className='object-contain' priority />
					</div>
					<div>
						<h1 className='text-2xl font-oswald uppercase tracking-wide text-primary'>{league.name}</h1>
						<p className='text-primary/80 font-medium mt-1'>{league.sport}</p>
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
		</div>
	);
}
