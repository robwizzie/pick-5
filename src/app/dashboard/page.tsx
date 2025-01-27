'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ActiveLeagues from '@/components/league/ActiveLeagues';

const Dashboard = () => {
	const router = useRouter();
	const { data: session } = useSession();
	const [leagues, setLeagues] = useState([]);

	useEffect(() => {
		const fetchLeagues = async () => {
			if (!session) return;

			try {
				const response = await fetch('/api/user/leagues', {
					headers: {
						Authorization: `Bearer ${session.accessToken}`
					}
				});

				if (!response.ok) {
					const errorText = await response.text();
					console.error(`Failed to fetch leagues: ${response.status} - ${errorText}`);
					return;
				}

				const data = await response.json();
				const normalizedLeagues = data.map((league: { _id: string; name: string; description: string }) => ({
					...league,
					id: league._id
				}));

				setLeagues(normalizedLeagues);
			} catch (error) {
				console.error('Network error fetching leagues:', error);
			}
		};

		fetchLeagues();
	}, [session]);

	return (
		<div className='h-[calc(100vh-4rem)] flex items-center justify-center'>
			<div className='w-full max-w-4xl px-4'>
				<Card className='shadow-2xl border-2 border-primary/20 rounded-[2rem] overflow-hidden'>
					<CardHeader className='bg-primary/10 border-b border-primary/20 p-6'>
						<CardTitle className='text-3xl font-oswald uppercase tracking-wide text-primary text-center flex items-center justify-center gap-4'>
							<Plus className='text-primary' /> Your Leagues
						</CardTitle>
					</CardHeader>
					<CardContent className='p-8 space-y-6'>
						{leagues.length > 0 ? (
							<>
								<ActiveLeagues leagues={leagues} />
								<div className='flex justify-center space-x-4 mt-6'>
									<Button className='flex items-center gap-2' onClick={() => router.push('/league/create')}>
										<Plus /> Create League
									</Button>
									<Button variant='success' className='flex items-center text-black gap-2' onClick={() => router.push('/league/join')}>
										<LogIn /> Join League
									</Button>
								</div>
							</>
						) : (
							<div className='flex flex-col items-center space-y-6'>
								<h2 className='text-xl font-medium text-muted-foreground text-center'>You haven't joined any leagues yet</h2>
								<p className='text-sm text-muted-foreground text-center mb-4'>Get started by creating a new league or joining an existing one</p>
								<div className='flex space-x-4'>
									<Button className='flex items-center gap-2' onClick={() => router.push('/league/create')}>
										<Plus /> Create League
									</Button>
									<Button variant='success' className='flex items-center text-black gap-2' onClick={() => router.push('/league/join')}>
										<LogIn /> Join League
									</Button>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export default Dashboard;
