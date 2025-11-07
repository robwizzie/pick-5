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
import { Share2, Copy, Check } from 'lucide-react';

interface League {
	name: string;
	sport: string;
	creatorId?: string;
}

export default function LeagueDetails() {
	const params = useParams();
	const id = (params?.id as string) || '';
	const [league, setLeague] = useState<League | null>(null);
	const router = useRouter();
	const { data: session } = useSession();
	const [showInviteModal, setShowInviteModal] = useState(false);
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
					{isCommissioner && (
						<Button onClick={handleGetInviteLink} disabled={loadingInvite} variant='outline' className='flex items-center gap-2 border-primary/50 hover:bg-primary/10'>
							<Share2 className='h-4 w-4' />
							Invite Link
						</Button>
					)}
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
		</div>
	);
}
