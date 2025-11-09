'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Link from 'next/link';

interface AdminTool {
	title: string;
	description: string;
	href: string;
	icon: string;
	category: 'odds' | 'picks';
}

const adminTools: AdminTool[] = [
	{
		title: 'Fetch Odds',
		description: 'Manually trigger odds fetch from The Odds API and store in database',
		href: '/admin/fetch-odds',
		icon: '📡',
		category: 'odds'
	},
	{
		title: 'Bulk Fix Odds',
		description: 'View all games missing odds and add them in bulk',
		href: '/admin/bulk-fix-odds',
		icon: '📊',
		category: 'odds'
	},
	{
		title: 'Fix Single Game Odds',
		description: 'Update odds for a specific game (updates picks + creates snapshot)',
		href: '/admin/fix-odds',
		icon: '🎯',
		category: 'odds'
	},
	{
		title: 'Fix Pick Odds',
		description: 'Retroactively add odds to existing picks and recalculate points',
		href: '/admin/fix-pick-odds',
		icon: '🔧',
		category: 'odds'
	},
	{
		title: 'Manual Picks Entry',
		description: 'Enter picks for any user in any league, even after games have started',
		href: '/admin/manual-picks',
		icon: '✍️',
		category: 'picks'
	}
];

export default function AdminDashboard() {
	const oddsList = adminTools.filter(t => t.category === 'odds');
	const picksList = adminTools.filter(t => t.category === 'picks');

	return (
		<div className='space-y-8'>
			<div>
				<h1 className='text-4xl font-display font-bold gradient-text mb-2'>Admin Dashboard</h1>
				<p className='text-muted-foreground'>
					Manage Pick 5 data, odds, and system operations
				</p>
			</div>

			{/* Quick Stats */}
			<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
				<Card className='glass border-white/10'>
					<CardContent className='pt-6'>
						<div className='flex items-center gap-4'>
							<div className='h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center text-2xl'>
								📈
							</div>
							<div>
								<p className='text-sm text-muted-foreground'>Cron Jobs</p>
								<p className='text-2xl font-bold'>2 Active</p>
								<p className='text-xs text-muted-foreground'>Master cron (odds + emails)</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className='glass border-white/10'>
					<CardContent className='pt-6'>
						<div className='flex items-center gap-4'>
							<div className='h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center text-2xl'>
								🔒
							</div>
							<div>
								<p className='text-sm text-muted-foreground'>Access Level</p>
								<p className='text-2xl font-bold'>Admin</p>
								<p className='text-xs text-muted-foreground'>Full system access</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Odds Management Tools */}
			<div>
				<h2 className='text-2xl font-bold mb-4 flex items-center gap-2'>
					<span className='text-2xl'>💰</span>
					Odds Management
				</h2>
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
					{oddsList.map(tool => (
						<Link key={tool.href} href={tool.href}>
							<Card className='glass border-white/10 hover:border-primary/50 transition-all cursor-pointer h-full group'>
								<CardHeader>
									<div className='flex items-start justify-between'>
										<div className='h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform'>
											{tool.icon}
										</div>
										<svg
											className='w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M9 5l7 7-7 7'
											/>
										</svg>
									</div>
									<CardTitle className='mt-4 group-hover:text-primary transition-colors'>
										{tool.title}
									</CardTitle>
									<CardDescription>{tool.description}</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					))}
				</div>
			</div>

			{/* Picks Management Tools */}
			<div>
				<h2 className='text-2xl font-bold mb-4 flex items-center gap-2'>
					<span className='text-2xl'>🏈</span>
					Picks Management
				</h2>
				<div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
					{picksList.map(tool => (
						<Link key={tool.href} href={tool.href}>
							<Card className='glass border-white/10 hover:border-primary/50 transition-all cursor-pointer h-full group'>
								<CardHeader>
									<div className='flex items-start justify-between'>
										<div className='h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform'>
											{tool.icon}
										</div>
										<svg
											className='w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'
										>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M9 5l7 7-7 7'
											/>
										</svg>
									</div>
									<CardTitle className='mt-4 group-hover:text-primary transition-colors'>
										{tool.title}
									</CardTitle>
									<CardDescription>{tool.description}</CardDescription>
								</CardHeader>
							</Card>
						</Link>
					))}
				</div>
			</div>

			{/* System Info */}
			<Card className='glass border-white/10'>
				<CardHeader>
					<CardTitle>System Information</CardTitle>
				</CardHeader>
				<CardContent className='space-y-3'>
					<div className='flex justify-between text-sm'>
						<span className='text-muted-foreground'>Environment</span>
						<span className='font-mono'>Production</span>
					</div>
					<div className='flex justify-between text-sm'>
						<span className='text-muted-foreground'>Odds API Provider</span>
						<span className='font-mono'>The Odds API</span>
					</div>
					<div className='flex justify-between text-sm'>
						<span className='text-muted-foreground'>Cron Schedule</span>
						<span className='font-mono'>Sun 9AM, Tue/Thu/Fri/Sat 2PM</span>
					</div>
					<div className='flex justify-between text-sm'>
						<span className='text-muted-foreground'>Database</span>
						<span className='font-mono'>MongoDB (Connected)</span>
					</div>
				</CardContent>
			</Card>

			{/* Important Notes */}
			<Card className='glass border-yellow-500/20 bg-yellow-500/5'>
				<CardHeader>
					<CardTitle className='flex items-center gap-2'>
						<span>⚠️</span>
						Important Notes
					</CardTitle>
				</CardHeader>
				<CardContent className='space-y-2 text-sm text-muted-foreground'>
					<p>
						• <strong>API Limit:</strong> The Odds API has a 500 calls/month limit. Use manual fetch sparingly.
					</p>
					<p>
						• <strong>Odds Snapshots:</strong> Snapshots are created automatically and can be manually added for games that need corrections.
					</p>
					<p>
						• <strong>Cron Jobs:</strong> Automatically fetch odds and send email reminders via scheduled cron jobs.
					</p>
					<p>
						• <strong>Manual Picks:</strong> Use the Manual Picks Entry tool to add picks for users who couldn&apos;t submit in time.
					</p>
					<p>
						• <strong>Access:</strong> This admin panel is only accessible to your user ID.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
