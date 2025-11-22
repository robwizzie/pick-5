'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Save, User, Image as ImageIcon, Loader2, Bell, BellOff, Mail, Smartphone } from 'lucide-react';

interface EmailPreferences {
	pickReminders: boolean;
	thursdayReminder: boolean;
	saturdayReminder: boolean;
	weeklyScoreEmail: boolean;
}

interface PushNotificationPreferences {
	gameResults: boolean;
	weeklyRecap: boolean;
}

export default function SettingsPage() {
	const { data: session, status, update } = useSession();
	const router = useRouter();
	const [activeTab, setActiveTab] = useState<'profile' | 'notifications'>('profile');

	// Profile state
	const [name, setName] = useState('');
	const [image, setImage] = useState('');
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState('');
	const [error, setError] = useState('');

	// Notification state
	const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>({
		pickReminders: true,
		thursdayReminder: true,
		saturdayReminder: true,
		weeklyScoreEmail: true
	});
	const [pushEnabled, setPushEnabled] = useState(false);
	const [pushNotificationPreferences, setPushNotificationPreferences] = useState<PushNotificationPreferences>({
		gameResults: true,
		weeklyRecap: true
	});
	const [pushSupported, setPushSupported] = useState(false);
	const [notifLoading, setNotifLoading] = useState(false);

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

	useEffect(() => {
		if (status === 'authenticated') {
			checkPushSupport();
			loadNotificationSettings();
		}
	}, [status]);

	const checkPushSupport = () => {
		if ('serviceWorker' in navigator && 'PushManager' in window) {
			setPushSupported(true);
		}
	};

	const loadNotificationSettings = async () => {
		try {
			const response = await fetch('/api/user/settings');
			if (response.ok) {
				const data = await response.json();
				setEmailPreferences(data.emailPreferences);
				if (data.pushNotificationPreferences) {
					setPushNotificationPreferences(data.pushNotificationPreferences);
				}

				// Check actual browser permission and subscription state
				await checkActualPushState(data.pushNotificationsEnabled);
			}
		} catch (error) {
			console.error('Error loading notification settings:', error);
		}
	};

	const checkActualPushState = async (dbPushEnabled: boolean) => {
		try {
			// Check if browser permission is granted
			const permission = await Notification.permission;

			// Check if there's an active subscription
			const registration = await navigator.serviceWorker.getRegistration('/sw.js');
			const subscription = registration ? await registration.pushManager.getSubscription() : null;

			// The actual state is enabled only if:
			// 1. Permission is granted AND
			// 2. There's an active subscription
			const actuallyEnabled = permission === 'granted' && subscription !== null;

			// If database says enabled but browser says otherwise, fix the state
			if (dbPushEnabled && !actuallyEnabled) {
				console.log('Push notifications are enabled in DB but not in browser. Syncing state...');
				setPushEnabled(false);
				// Update the database to reflect reality
				await fetch('/api/user/settings', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						emailPreferences,
						pushNotificationsEnabled: false,
						pushNotificationPreferences
					})
				});
			} else {
				setPushEnabled(actuallyEnabled);
			}
		} catch (error) {
			console.error('Error checking push state:', error);
			// Fallback to database state
			setPushEnabled(dbPushEnabled);
		}
	};

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

	const handleSaveNotifications = async () => {
		try {
			setNotifLoading(true);
			setMessage('');
			setError('');

			const response = await fetch('/api/user/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					emailPreferences,
					pushNotificationsEnabled: pushEnabled,
					pushNotificationPreferences
				})
			});

			if (!response.ok) {
				throw new Error('Failed to save notification settings');
			}

			setMessage('Notification settings saved successfully!');
			setTimeout(() => setMessage(''), 3000);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save notification settings');
			setTimeout(() => setError(''), 5000);
		} finally {
			setNotifLoading(false);
		}
	};

	const handleEnablePush = async () => {
		if (!pushSupported) {
			setError('Push notifications are not supported in this browser');
			return;
		}

		try {
			setNotifLoading(true);
			setError('');
			setMessage('');

			const registration = await navigator.serviceWorker.register('/sw.js');
			await navigator.serviceWorker.ready;

			const permission = await Notification.requestPermission();

			if (permission !== 'granted') {
				setError('Please allow notifications to enable push reminders');
				setNotifLoading(false);
				return;
			}

			const vapidResponse = await fetch('/api/push/vapid-public-key');
			const { publicKey } = await vapidResponse.json();

			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(publicKey)
			});

			const response = await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(subscription)
			});

			if (response.ok) {
				setPushEnabled(true);
				setMessage('Push notifications enabled!');
				setTimeout(() => setMessage(''), 3000);
			}
		} catch (err) {
			console.error('Error enabling push notifications:', err);
			setError('Failed to enable push notifications');
			setTimeout(() => setError(''), 5000);
		} finally {
			setNotifLoading(false);
		}
	};

	const handleDisablePush = async () => {
		try {
			setNotifLoading(true);

			// Try to get the service worker and subscription
			const registration = await navigator.serviceWorker.getRegistration('/sw.js');
			const subscription = registration ? await registration.pushManager.getSubscription() : null;

			// If there's an active subscription, unsubscribe from it
			if (subscription) {
				await fetch('/api/push/unsubscribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ endpoint: subscription.endpoint })
				});

				await subscription.unsubscribe();
			}

			// Always update the database state, even if there was no subscription
			await fetch('/api/user/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					emailPreferences,
					pushNotificationsEnabled: false,
					pushNotificationPreferences
				})
			});

			// Update local state
			setPushEnabled(false);
			setMessage('Push notifications disabled');
			setTimeout(() => setMessage(''), 3000);
		} catch (err) {
			console.error('Error disabling push notifications:', err);
			setError('Failed to disable push notifications');
			setTimeout(() => setError(''), 5000);
		} finally {
			setNotifLoading(false);
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
			<Card className='glass border-white/10 p-6 sm:p-8'>
				<div className='mb-6'>
					<h1 className='text-3xl font-bold text-foreground mb-2'>Settings</h1>
					<p className='text-muted-foreground'>Manage your profile and notification preferences</p>
				</div>

				{/* Tabs */}
				<div className='flex gap-2 mb-6 border-b border-white/10'>
					<button
						onClick={() => setActiveTab('profile')}
						className={`px-4 py-2 font-medium transition-colors border-b-2 ${
							activeTab === 'profile' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
						}`}>
						<div className='flex items-center gap-2'>
							<User className='h-4 w-4' />
							Profile
						</div>
					</button>
					<button
						onClick={() => setActiveTab('notifications')}
						className={`px-4 py-2 font-medium transition-colors border-b-2 ${
							activeTab === 'notifications' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
						}`}>
						<div className='flex items-center gap-2'>
							<Bell className='h-4 w-4' />
							Notifications
						</div>
					</button>
				</div>

				{/* Profile Tab */}
				{activeTab === 'profile' && (<div>

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
				</div>
				)}

				{/* Notifications Tab */}
				{activeTab === 'notifications' && (
					<div className='space-y-6'>
						{/* Email Notifications Section */}
						<div className='space-y-4'>
							<div className='flex items-center gap-2 mb-4'>
								<Mail className='h-5 w-5 text-primary' />
								<h3 className='text-lg font-semibold'>Email Notifications</h3>
							</div>

							{/* Master Switch */}
							<div className='flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20'>
								<div className='space-y-1'>
									<Label htmlFor='pick-reminders' className='text-base font-semibold'>
										Pick Reminders
									</Label>
									<p className='text-sm text-muted-foreground'>Receive email reminders when you haven&apos;t made your picks</p>
								</div>
								<Switch
									id='pick-reminders'
									checked={emailPreferences.pickReminders}
									onCheckedChange={checked => setEmailPreferences(prev => ({ ...prev, pickReminders: checked }))}
								/>
							</div>

							{/* Thursday Reminder */}
							{emailPreferences.pickReminders && (
								<div className='space-y-4 p-4 rounded-lg border border-white/10'>
									<div className='flex items-center justify-between'>
										<div className='space-y-1'>
											<Label htmlFor='thursday-reminder' className='text-base font-medium'>
												Thursday Reminder
											</Label>
											<p className='text-sm text-muted-foreground'>Remind me about Thursday Night Football</p>
										</div>
										<Switch
											id='thursday-reminder'
											checked={emailPreferences.thursdayReminder}
											onCheckedChange={checked => setEmailPreferences(prev => ({ ...prev, thursdayReminder: checked }))}
										/>
									</div>
								</div>
							)}

							{/* Saturday Reminder */}
							{emailPreferences.pickReminders && (
								<div className='space-y-4 p-4 rounded-lg border border-white/10'>
									<div className='flex items-center justify-between'>
										<div className='space-y-1'>
											<Label htmlFor='saturday-reminder' className='text-base font-medium'>
												Saturday Reminder
											</Label>
											<p className='text-sm text-muted-foreground'>Last chance reminder before Sunday games</p>
										</div>
										<Switch
											id='saturday-reminder'
											checked={emailPreferences.saturdayReminder}
											onCheckedChange={checked => setEmailPreferences(prev => ({ ...prev, saturdayReminder: checked }))}
										/>
									</div>
								</div>
							)}

							{/* Weekly Score Email */}
							<div className='flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20'>
								<div className='space-y-1'>
									<Label htmlFor='weekly-score-email' className='text-base font-semibold'>
										Weekly Score Emails
									</Label>
									<p className='text-sm text-muted-foreground'>Receive a summary email every Tuesday with your weekly results</p>
								</div>
								<Switch
									id='weekly-score-email'
									checked={emailPreferences.weeklyScoreEmail}
									onCheckedChange={checked => setEmailPreferences(prev => ({ ...prev, weeklyScoreEmail: checked }))}
								/>
							</div>
						</div>

						{/* Push Notifications Section */}
						{pushSupported && (
							<div className='space-y-4'>
								<div className='flex items-center gap-2 mb-4'>
									<Smartphone className='h-5 w-5 text-primary' />
									<h3 className='text-lg font-semibold'>Push Notifications</h3>
								</div>

								<div className='flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20'>
									<div className='space-y-1'>
										<Label htmlFor='push-notifications' className='text-base font-semibold'>
											{pushEnabled ? (
												<span className='flex items-center gap-2'>
													<Bell className='h-4 w-4 text-green-500' />
													Push Notifications Enabled
												</span>
											) : (
												<span className='flex items-center gap-2'>
													<BellOff className='h-4 w-4 text-muted-foreground' />
													Push Notifications Disabled
												</span>
											)}
										</Label>
										<p className='text-sm text-muted-foreground'>Receive real-time notifications on this device</p>
									</div>
									{pushEnabled ? (
										<Button onClick={handleDisablePush} variant='outline' className='text-red-500 border-red-500/50' disabled={notifLoading}>
											{notifLoading ? (
												<>
													<Loader2 className='h-4 w-4 mr-2 animate-spin' />
													Disabling...
												</>
											) : (
												'Disable'
											)}
										</Button>
									) : (
										<Button onClick={handleEnablePush} className='bg-primary hover:bg-primary/90' disabled={notifLoading}>
											{notifLoading ? (
												<>
													<Loader2 className='h-4 w-4 mr-2 animate-spin' />
													Enabling...
												</>
											) : (
												'Enable'
											)}
										</Button>
									)}
								</div>

								{/* Game Result Notifications */}
								{pushEnabled && (
									<div className='space-y-4 p-4 rounded-lg border border-white/10'>
										<div className='flex items-center justify-between'>
											<div className='space-y-1'>
												<Label htmlFor='game-results' className='text-base font-medium'>
													Game Result Notifications
												</Label>
												<p className='text-sm text-muted-foreground'>Get notified when your picks win or lose</p>
											</div>
											<Switch
												id='game-results'
												checked={pushNotificationPreferences.gameResults}
												onCheckedChange={checked => setPushNotificationPreferences(prev => ({ ...prev, gameResults: checked }))}
											/>
										</div>
									</div>
								)}

								{/* Weekly Recap Notifications */}
								{pushEnabled && (
									<div className='space-y-4 p-4 rounded-lg border border-white/10'>
										<div className='flex items-center justify-between'>
											<div className='space-y-1'>
												<Label htmlFor='weekly-recap' className='text-base font-medium'>
													Weekly Recap Notifications
												</Label>
												<p className='text-sm text-muted-foreground'>Get a summary every Tuesday with your results and standings</p>
											</div>
											<Switch
												id='weekly-recap'
												checked={pushNotificationPreferences.weeklyRecap}
												onCheckedChange={checked => setPushNotificationPreferences(prev => ({ ...prev, weeklyRecap: checked }))}
											/>
										</div>
									</div>
								)}
							</div>
						)}

						{/* Save Button */}
						<Button onClick={handleSaveNotifications} disabled={notifLoading} className='w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-6'>
							{notifLoading ? (
								<>
									<Loader2 className='h-4 w-4 mr-2 animate-spin' />
									Saving Changes...
								</>
							) : (
								<>
									<Save className='h-4 w-4 mr-2' />
									Save Notification Settings
								</>
							)}
						</Button>

						{/* Info Note */}
						<div className='p-4 rounded-lg bg-primary/5 border border-primary/20'>
							<p className='text-sm text-muted-foreground'>
								<strong>Note:</strong> Reminders are only sent for leagues where you haven&apos;t submitted picks yet. If you&apos;ve made picks for all your leagues, you won&apos;t receive any reminders. Emails are sent once per day on Thursdays and Saturdays.
							</p>
						</div>
					</div>
				)}
			</Card>
		</div>
	);
}

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const rawData = window.atob(base64);
	const outputArray = new Uint8Array(rawData.length);
	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}
