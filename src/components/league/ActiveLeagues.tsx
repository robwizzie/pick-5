'use client';

import { useRouter } from 'next/navigation';
import { MoreVertical, Link as LinkIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface League {
	_id: string; // Use `_id` as the unique identifier
	name: string;
	sport: string;
	creatorId?: string;
	inviteCode?: string;
}

interface ActiveLeaguesProps {
	leagues: League[];
	userId?: string;
}

export default function ActiveLeagues({ leagues, userId }: ActiveLeaguesProps) {
	const router = useRouter();
	const [copiedLeagueId, setCopiedLeagueId] = useState<string | null>(null);

	const handleCopyInviteLink = (e: React.MouseEvent, league: League) => {
		e.stopPropagation();
		if (!league.inviteCode) return;

		const inviteUrl = `${window.location.origin}/league/join/${league.inviteCode}`;
		navigator.clipboard.writeText(inviteUrl);

		// Show feedback
		setCopiedLeagueId(league._id);
		setTimeout(() => setCopiedLeagueId(null), 2000);
	};

	const handleDropdownClick = (e: React.MouseEvent) => {
		e.stopPropagation();
	};

	return (
		<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
			{leagues.map(league => {
				const isCommissioner = userId && league.creatorId === userId;

				return (
					<div key={league._id} className='relative'>
						<button onClick={() => router.push(`/league/${league._id}`)} className='w-full p-6 bg-card border-2 border-primary/20 rounded-lg text-left transition-all hover:bg-primary/10'>
							<div className='space-y-2'>
								<div className='flex items-start justify-between gap-2'>
									<h3 className='font-oswald text-xl uppercase tracking-wide text-primary'>{league.name}</h3>
									{isCommissioner && (
										<div onClick={handleDropdownClick}>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button variant='ghost' size='sm' className='h-8 w-8 p-0 hover:bg-primary/20'>
														<MoreVertical className='h-4 w-4' />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align='end' className='glass border-white/10 backdrop-blur-xl'>
													<DropdownMenuItem onClick={e => handleCopyInviteLink(e, league)} className='cursor-pointer hover:bg-primary/10'>
														<LinkIcon className='h-4 w-4 mr-2' />
														{copiedLeagueId === league._id ? 'Copied!' : 'Copy League Link'}
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</div>
									)}
								</div>
								<div className='flex items-center gap-2'>
									<span className='text-sm text-primary/80 font-medium'>{league.sport}</span>
								</div>
							</div>
						</button>
					</div>
				);
			})}
		</div>
	);
}
