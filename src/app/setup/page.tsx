'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

export default function SetupPage() {
	const router = useRouter();
	interface League {
		name: string;
		sport: string;
		mode: string;
		_id: string;
	}
	const [league, setLeague] = useState<League | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Fetch the latest league data or pass it via query params
		const fetchLeague = async () => {
			try {
				const response = await fetch('/api/league/latest'); // Fetch the most recently created league
				if (response.ok) {
					const leagueData = await response.json();
					setLeague(leagueData);
				} else {
					setError('Failed to fetch league details.');
				}
			} catch {
				setError('An unexpected error occurred.');
			}
		};

		fetchLeague();
	}, []);

	return (
		<div className='h-[calc(100vh-4rem)] flex items-center justify-center'>
			<Card className='w-[500px] p-6'>
				<CardHeader>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary text-center'>League Setup</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4'>
					{error && (
						<Alert variant='destructive'>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{league ? (
						<div className='space-y-4'>
							<p className='text-muted-foreground'>Your league has been successfully created!</p>
							<div>
								<h3 className='font-medium text-lg'>League Details:</h3>
								<ul className='list-disc pl-5 text-muted-foreground'>
									<li>
										<strong>Name:</strong> {league.name}
									</li>
									<li>
										<strong>Sport:</strong> {league.sport}
									</li>
									<li>
										<strong>Scoring Mode:</strong> {league.mode === 'steve' ? 'Steve Mode' : 'Standard Pick 5 Mode'}
									</li>
								</ul>
							</div>

							{/* Navigation Options */}
							<div className='space-y-2'>
								<Button onClick={() => router.push('/dashboard')} className='w-full'>
									Go to Dashboard
								</Button>
								<Button onClick={() => router.push(`/league/${league._id}`)} variant='success' className='w-full'>
									View League
								</Button>
							</div>
						</div>
					) : (
						<Spinner />
					)}
				</CardContent>
			</Card>
		</div>
	);
}
