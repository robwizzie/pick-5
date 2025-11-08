'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Save, User, Image as ImageIcon, Loader2 } from 'lucide-react';

export default function SettingsPage() {
	const { data: session, status, update } = useSession();
	const router = useRouter();
	const [name, setName] = useState('');
	const [image, setImage] = useState('');
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState('');
	const [error, setError] = useState('');

	useEffect(() => {
		if (status === 'unauthenticated') {
			router.push('/login');
		}
	}, [status, router]);

	useEffect(() => {
		if (session?.user) {
			setName(session.user.name || '');
			setImage(session.user.image || '');
		}
	}, [session]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setMessage('');
		setError('');

		try {
			const response = await fetch('/api/user/profile', {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					name: name.trim(),
					image: image.trim()
				})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to update profile');
			}

			// Update the session with new data
			await update({
				...session,
				user: {
					...session?.user,
					name: data.name,
					image: data.image
				}
			});

			setMessage('Profile updated successfully!');
			setTimeout(() => setMessage(''), 3000);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to update profile');
			setTimeout(() => setError(''), 5000);
		} finally {
			setLoading(false);
		}
	};

	if (status === 'loading') {
		return (
			<div className='min-h-screen flex items-center justify-center'>
				<Loader2 className='h-8 w-8 animate-spin text-primary' />
			</div>
		);
	}

	if (!session) {
		return null;
	}

	return (
		<div className='container mx-auto px-4 py-8 max-w-2xl'>
			<div className='mb-6'>
				<Button variant='ghost' onClick={() => router.push('/dashboard')} className='flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-card/80 transition-colors'>
					<ArrowLeft className='h-4 w-4' />
					Back to Dashboard
				</Button>
			</div>

			<Card className='glass border-white/10 p-6 sm:p-8'>
				<div className='mb-6'>
					<h1 className='text-3xl font-bold text-foreground mb-2'>Profile Settings</h1>
					<p className='text-muted-foreground'>Update your profile information</p>
				</div>

				<form onSubmit={handleSubmit} className='space-y-6'>
					{/* Profile Picture Preview */}
					<div className='flex justify-center'>
						<div className='relative'>
							<Avatar className='h-24 w-24 ring-2 ring-primary/50'>
								<AvatarImage src={image || session.user?.image || ''} alt={name || session.user?.name || ''} />
								<AvatarFallback className='bg-primary/20 text-primary text-2xl font-semibold'>{(name || session.user?.name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
							</Avatar>
						</div>
					</div>

					{/* Name Field */}
					<div className='space-y-2'>
						<label htmlFor='name' className='flex items-center gap-2 text-sm font-medium text-foreground'>
							<User className='h-4 w-4 text-primary' />
							Display Name
						</label>
						<Input id='name' type='text' value={name} onChange={e => setName(e.target.value)} placeholder='Enter your name' required className='glass border-white/10 bg-background/50 focus:border-primary/50' />
					</div>

					{/* Profile Picture URL Field */}
					<div className='space-y-2'>
						<label htmlFor='image' className='flex items-center gap-2 text-sm font-medium text-foreground'>
							<ImageIcon className='h-4 w-4 text-primary' />
							Profile Picture URL
						</label>
						<Input id='image' type='url' value={image} onChange={e => setImage(e.target.value)} placeholder='https://example.com/your-image.jpg' className='glass border-white/10 bg-background/50 focus:border-primary/50' />
						<p className='text-xs text-muted-foreground'>Enter a direct URL to an image. Leave blank to keep current picture.</p>
					</div>

					{/* Email (Read-only) */}
					<div className='space-y-2'>
						<label className='text-sm font-medium text-foreground'>Email Address</label>
						<Input type='email' value={session.user?.email || ''} disabled className='glass border-white/10 bg-background/30 text-muted-foreground cursor-not-allowed' />
						<p className='text-xs text-muted-foreground'>Email cannot be changed</p>
					</div>

					{/* Success/Error Messages */}
					{message && (
						<div className='p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm flex items-center gap-2'>
							<div className='h-2 w-2 rounded-full bg-green-500' />
							{message}
						</div>
					)}

					{error && (
						<div className='p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-2'>
							<div className='h-2 w-2 rounded-full bg-red-500' />
							{error}
						</div>
					)}

					{/* Submit Button */}
					<Button type='submit' disabled={loading} className='w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6'>
						{loading ? (
							<>
								<Loader2 className='h-4 w-4 mr-2 animate-spin' />
								Saving Changes...
							</>
						) : (
							<>
								<Save className='h-4 w-4 mr-2' />
								Save Changes
							</>
						)}
					</Button>
				</form>
			</Card>
		</div>
	);
}
