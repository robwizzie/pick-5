import Link from 'next/link';
import { LayoutDashboard, MailX, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/ui/page';

export default function UnsubscribedPage() {
	return (
		<PageContainer size='narrow' className='flex min-h-[calc(100dvh-var(--nav-height))] items-center justify-center'>
			<div className='glass relative w-full max-w-md animate-scale-in overflow-hidden rounded-3xl'>
				<div aria-hidden className='pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-primary/25 blur-3xl' />
				<div className='relative flex flex-col items-center px-6 pb-7 pt-9 text-center sm:px-8'>
					<div className='relative mb-5'>
						<div className='absolute inset-0 rounded-full bg-primary/30 blur-xl' />
						<div className='relative grid h-16 w-16 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary'>
							<MailX className='h-7 w-7' />
						</div>
					</div>
					<p className='eyebrow mb-2'>Email preferences</p>
					<h1 className='display-heading text-4xl sm:text-5xl'>You&apos;re unsubscribed</h1>
					<p className='mt-3 text-sm text-muted-foreground'>You won&apos;t receive any more pick reminder emails from us.</p>
					<p className='mt-4 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-xs text-muted-foreground'>
						Changed your mind? You can re-enable email reminders any time in your settings.
					</p>

					<div className='mt-6 grid w-full gap-2 sm:grid-cols-2'>
						<Button asChild variant='outline' size='lg' className='w-full'>
							<Link href='/settings'>
								<Settings /> Settings
							</Link>
						</Button>
						<Button asChild size='lg' className='w-full'>
							<Link href='/dashboard'>
								<LayoutDashboard /> Dashboard
							</Link>
						</Button>
					</div>
				</div>
			</div>
		</PageContainer>
	);
}
