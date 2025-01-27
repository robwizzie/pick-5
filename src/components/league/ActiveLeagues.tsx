'use client';

import { useRouter } from 'next/navigation';

interface League {
	_id: string; // Use `_id` as the unique identifier
	name: string;
	sport: string;
}

interface ActiveLeaguesProps {
	leagues: League[];
}

export default function ActiveLeagues({ leagues }: ActiveLeaguesProps) {
	const router = useRouter();

	return (
		<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
			{leagues.map(league => (
				<button key={league._id} onClick={() => router.push(`/league/${league._id}`)} className='w-full p-6 bg-card border-2 border-primary/20 rounded-lg text-left transition-all hover:bg-primary/10'>
					<div className='space-y-2'>
						<h3 className='font-oswald text-xl uppercase tracking-wide text-primary'>{league.name}</h3>
						<div className='flex items-center gap-2'>
							<span className='text-sm text-primary/80 font-medium'>{league.sport}</span>
						</div>
					</div>
				</button>
			))}
		</div>
	);
}
