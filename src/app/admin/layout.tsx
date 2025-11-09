import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

const ADMIN_USER_ID = '67c124e9cce9530ce4c1a655';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const session = await getServerSession(authOptions);

	// Check if user is logged in
	if (!session?.user) {
		redirect('/api/auth/signin');
	}

	// Check if user is admin
	// @ts-ignore - session.user.id exists but TypeScript doesn't know about it
	if (session.user.id !== ADMIN_USER_ID) {
		redirect('/');
	}

	return (
		<div className='min-h-screen bg-gradient-to-br from-background via-background to-primary/5'>
			<div className='border-b border-white/10 bg-black/20 backdrop-blur-sm'>
				<div className='container mx-auto px-4 py-4'>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-3'>
							<div className='h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center'>
								<svg
									className='w-5 h-5 text-primary'
									fill='none'
									stroke='currentColor'
									viewBox='0 0 24 24'
								>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z'
									/>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M15 12a3 3 0 11-6 0 3 3 0 016 0z'
									/>
								</svg>
							</div>
							<div>
								<h1 className='text-xl font-bold text-primary'>Admin Panel</h1>
								<p className='text-xs text-muted-foreground'>Pick 5 Management Tools</p>
							</div>
						</div>
						<a
							href='/'
							className='text-sm text-muted-foreground hover:text-primary transition-colors'
						>
							← Back to App
						</a>
					</div>
				</div>
			</div>
			<div className='container mx-auto px-4 py-8'>{children}</div>
		</div>
	);
}
