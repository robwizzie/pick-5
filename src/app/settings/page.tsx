'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Bell, BellOff, Info, Loader2, Mail, Save, Settings as SettingsIcon, Smartphone, User, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { PageContainer, PageHeader, Pill } from '@/components/ui/page';
import { cn } from '@/lib/utils';

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

interface UserSettingsResponse {
	emailPreferences: EmailPreferences;
	pushNotificationsEnabled: boolean;
	pushNotificationPreferences?: PushNotificationPreferences;
}

const DEFAULT_EMAIL_PREFERENCES: EmailPreferences = {
	pickReminders: true,
	thursdayReminder: true,
	saturdayReminder: true,
	weeklyScoreEmail: true
};

const DEFAULT_PUSH_PREFERENCES: PushNotificationPreferences = {
	gameResults: true,
	weeklyRecap: true
};

export default function SettingsPage() {
	const { data: session, status, update } = useSession();
	const router = useRouter();

	// Profile state
	const [name, setName] = useState('');
	const [image, setImage] = useState('');
	const [loading, setLoading] = useState(false);

	// Notification state
	const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>(DEFAULT_EMAIL_PREFERENCES);
	const [pushEnabled, setPushEnabled] = useState(false);
	const [pushNotificationPreferences, setPushNotificationPreferences] = useState<PushNotificationPreferences>(DEFAULT_PUSH_PREFERENCES);
	const [pushSupported, setPushSupported] = useState(false);
	const [notifLoading, setNotifLoading] = useState(false);
	const [pushLoading, setPushLoading] = useState(false);

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

	const checkActualPushState = useCallback(async (settings: UserSettingsResponse) => {
		const dbPushEnabled = settings.pushNotificationsEnabled;
		try {
			const permission = Notification.permission;
			const registration = await navigator.serviceWorker.getRegistration('/sw.js');
			const subscription = registration ? await registration.pushManager.getSubscription() : null;

			// Enabled only if permission is granted AND there's an active subscription
			const actuallyEnabled = permission === 'granted' && subscription !== null;

			// If the database says enabled but the browser says otherwise, sync the DB to reality.
			// Use the freshly loaded preferences so we never overwrite them with defaults.
			if (dbPushEnabled && !actuallyEnabled) {
				setPushEnabled(false);
				await fetch('/api/user/settings', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						emailPreferences: settings.emailPreferences,
						pushNotificationsEnabled: false,
						pushNotificationPreferences: settings.pushNotificationPreferences ?? DEFAULT_PUSH_PREFERENCES
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
	}, []);

	useEffect(() => {
		if (status !== 'authenticated') return;

		const supported = 'serviceWorker' in navigator && 'PushManager' in window;
		setPushSupported(supported);

		const loadNotificationSettings = async () => {
			try {
				const response = await fetch('/api/user/settings');
				if (!response.ok) return;
				const data: UserSettingsResponse = await response.json();
				setEmailPreferences(data.emailPreferences);
				if (data.pushNotificationPreferences) {
					setPushNotificationPreferences(data.pushNotificationPreferences);
				}
				if (supported) {
					await checkActualPushState(data);
				} else {
					setPushEnabled(data.pushNotificationsEnabled);
				}
			} catch (error) {
				console.error('Error loading notification settings:', error);
			}
		};

		loadNotificationSettings();
	}, [status, checkActualPushState]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);

		try {
			const response = await fetch('/api/user/profile', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: name.trim(),
					image: image.trim()
				})
			});

			const data: { name?: string; image?: string; error?: string } = await response.json();

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

			toast.success('Profile updated');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to update profile');
		} finally {
			setLoading(false);
		}
	};

	const handleSaveNotifications = async () => {
		try {
			setNotifLoading(true);

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

			toast.success('Notification settings saved');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to save notification settings');
		} finally {
			setNotifLoading(false);
		}
	};

	const handleEnablePush = async () => {
		if (!pushSupported) {
			toast.error('Push notifications are not supported in this browser');
			return;
		}

		try {
			setPushLoading(true);

			const registration = await navigator.serviceWorker.register('/sw.js');
			await navigator.serviceWorker.ready;

			const permission = await Notification.requestPermission();

			if (permission !== 'granted') {
				toast.error('Please allow notifications to enable push reminders');
				return;
			}

			const vapidResponse = await fetch('/api/push/vapid-public-key');
			const { publicKey }: { publicKey: string } = await vapidResponse.json();

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
				toast.success('Push notifications enabled');
			} else {
				toast.error('Failed to enable push notifications');
			}
		} catch (err) {
			console.error('Error enabling push notifications:', err);
			toast.error('Failed to enable push notifications');
		} finally {
			setPushLoading(false);
		}
	};

	const handleDisablePush = async () => {
		try {
			setPushLoading(true);

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

			setPushEnabled(false);
			toast.success('Push notifications disabled');
		} catch (err) {
			console.error('Error disabling push notifications:', err);
			toast.error('Failed to disable push notifications');
		} finally {
			setPushLoading(false);
		}
	};

	if (status === 'loading' || !session) {
		if (status !== 'loading') return null;
		return (
			<PageContainer size='narrow'>
				<Skeleton className='mb-3 h-4 w-24' />
				<Skeleton className='mb-10 h-14 w-56' />
				<div className='space-y-6'>
					<Skeleton className='h-72 rounded-2xl' />
					<Skeleton className='h-80 rounded-2xl' />
				</div>
			</PageContainer>
		);
	}

	const displayName = name || session.user?.name || '';

	return (
		<PageContainer size='narrow'>
			<PageHeader
				eyebrow={
					<>
						<SettingsIcon className='h-3.5 w-3.5 text-primary' /> Account
					</>
				}
				title='Settings'
				description='Manage your profile and how Pick 5 keeps you in the loop.'
			/>

			<div className='space-y-8'>
				{/* Profile */}
				<SettingsSection title='Profile' description='How you appear on leaderboards and in your leagues.' icon={User}>
					<form onSubmit={handleSubmit}>
						<div className='flex items-center gap-4 border-b border-white/[0.07] p-5 sm:p-6'>
							<Avatar className='h-16 w-16 ring-1 ring-white/10 sm:h-20 sm:w-20'>
								<AvatarImage src={image || session.user?.image || ''} alt={displayName} />
								<AvatarFallback className='bg-primary/15 font-display text-2xl font-bold italic text-primary'>{(displayName || 'U').charAt(0).toUpperCase()}</AvatarFallback>
							</Avatar>
							<div className='min-w-0'>
								<p className='truncate font-display text-2xl font-bold uppercase italic leading-tight tracking-tight'>{displayName || 'Your name'}</p>
								<p className='truncate text-sm text-muted-foreground'>{session.user?.email}</p>
							</div>
						</div>

						<div className='space-y-5 p-5 sm:p-6'>
							<Field id='name' label='Display name' help='Shown to everyone in your leagues.'>
								<Input id='name' type='text' value={name} onChange={e => setName(e.target.value)} placeholder='Enter your name' required autoComplete='name' />
							</Field>

							<Field id='image' label='Profile picture URL' help='A direct link to an image. Leave blank to keep your current picture.'>
								<Input id='image' type='url' value={image} onChange={e => setImage(e.target.value)} placeholder='https://example.com/your-image.jpg' />
							</Field>

							<Field id='email' label='Email address' help='Your sign-in email can’t be changed.'>
								<Input id='email' type='email' value={session.user?.email || ''} disabled />
							</Field>
						</div>

						<div className='flex justify-end border-t border-white/[0.07] p-4 sm:px-6'>
							<Button type='submit' disabled={loading} className='w-full sm:w-auto'>
								{loading ? <Loader2 className='animate-spin' /> : <Save />}
								{loading ? 'Saving…' : 'Save profile'}
							</Button>
						</div>
					</form>
				</SettingsSection>

				{/* Email notifications */}
				<SettingsSection title='Email' description='Reminders and recaps sent to your inbox.' icon={Mail}>
					<div className='divide-y divide-white/[0.07]'>
						<SettingRow
							id='pick-reminders'
							label='Pick reminders'
							description='Email me when I haven’t made my picks yet.'
							checked={emailPreferences.pickReminders}
							onCheckedChange={checked => setEmailPreferences(prev => ({ ...prev, pickReminders: checked }))}
						/>
						{emailPreferences.pickReminders && (
							<>
								<SettingRow
									id='thursday-reminder'
									label='Thursday reminder'
									description='Heads-up before Thursday Night Football.'
									nested
									checked={emailPreferences.thursdayReminder}
									onCheckedChange={checked => setEmailPreferences(prev => ({ ...prev, thursdayReminder: checked }))}
								/>
								<SettingRow
									id='saturday-reminder'
									label='Saturday reminder'
									description='Last call before Sunday’s games.'
									nested
									checked={emailPreferences.saturdayReminder}
									onCheckedChange={checked => setEmailPreferences(prev => ({ ...prev, saturdayReminder: checked }))}
								/>
							</>
						)}
						<SettingRow
							id='weekly-score-email'
							label='Weekly score email'
							description='A Tuesday summary of your weekly results.'
							checked={emailPreferences.weeklyScoreEmail}
							onCheckedChange={checked => setEmailPreferences(prev => ({ ...prev, weeklyScoreEmail: checked }))}
						/>
					</div>
				</SettingsSection>

				{/* Push notifications */}
				{pushSupported && (
					<SettingsSection title='Push' description='Real-time alerts on this device.' icon={Smartphone}>
						<div className='divide-y divide-white/[0.07]'>
							<div className='flex items-center justify-between gap-4 p-4 sm:px-6'>
								<div className='min-w-0'>
									<p className='flex items-center gap-2 text-sm font-semibold'>
										{pushEnabled ? <Bell className='h-4 w-4 text-accent' /> : <BellOff className='h-4 w-4 text-muted-foreground' />}
										Push notifications
										<Pill tone={pushEnabled ? 'accent' : 'muted'}>{pushEnabled ? 'On' : 'Off'}</Pill>
									</p>
									<p className='mt-1 text-sm text-muted-foreground'>Enable alerts for this browser or installed app.</p>
								</div>
								{pushEnabled ? (
									<Button variant='outline' size='sm' onClick={handleDisablePush} disabled={pushLoading} className='shrink-0'>
										{pushLoading && <Loader2 className='animate-spin' />}
										Disable
									</Button>
								) : (
									<Button size='sm' onClick={handleEnablePush} disabled={pushLoading} className='shrink-0'>
										{pushLoading && <Loader2 className='animate-spin' />}
										Enable
									</Button>
								)}
							</div>
							{pushEnabled && (
								<>
									<SettingRow
										id='game-results'
										label='Game results'
										description='Get notified when your picks win or lose.'
										checked={pushNotificationPreferences.gameResults}
										onCheckedChange={checked => setPushNotificationPreferences(prev => ({ ...prev, gameResults: checked }))}
									/>
									<SettingRow
										id='weekly-recap'
										label='Weekly recap'
										description='A Tuesday summary with your results and standings.'
										checked={pushNotificationPreferences.weeklyRecap}
										onCheckedChange={checked => setPushNotificationPreferences(prev => ({ ...prev, weeklyRecap: checked }))}
									/>
								</>
							)}
						</div>
					</SettingsSection>
				)}

				<div className='space-y-4'>
					<div className='flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-4 text-sm text-muted-foreground'>
						<Info className='mt-0.5 h-4 w-4 shrink-0 text-primary' />
						<p>
							Reminders are only sent for leagues where you haven&apos;t submitted picks yet. If you&apos;ve made picks for all your leagues, you won&apos;t receive any reminders. Emails are
							sent once per day on Thursdays and Saturdays.
						</p>
					</div>
					<Button onClick={handleSaveNotifications} disabled={notifLoading} size='lg' className='w-full'>
						{notifLoading ? <Loader2 className='animate-spin' /> : <Save />}
						{notifLoading ? 'Saving…' : 'Save notification settings'}
					</Button>
				</div>
			</div>
		</PageContainer>
	);
}

function SettingsSection({ title, description, icon: Icon, children }: { title: string; description: string; icon: LucideIcon; children: React.ReactNode }) {
	return (
		<section className='animate-slide-up'>
			<div className='mb-3 flex items-center gap-3 px-1'>
				<span className='grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary'>
					<Icon className='h-4 w-4' />
				</span>
				<div>
					<h2 className='font-display text-xl font-bold uppercase italic leading-none tracking-tight'>{title}</h2>
					<p className='mt-1 text-xs text-muted-foreground'>{description}</p>
				</div>
			</div>
			<Card className='overflow-hidden'>{children}</Card>
		</section>
	);
}

function SettingRow({
	id,
	label,
	description,
	checked,
	onCheckedChange,
	nested = false
}: {
	id: string;
	label: string;
	description: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
	nested?: boolean;
}) {
	return (
		<div className={cn('flex items-center justify-between gap-4 p-4 transition-colors hover:bg-white/[0.02] sm:px-6', nested && 'bg-white/[0.015] pl-8 sm:pl-10')}>
			<div className='min-w-0'>
				<Label htmlFor={id} className='cursor-pointer text-sm font-semibold'>
					{label}
				</Label>
				<p className='mt-1 text-sm text-muted-foreground'>{description}</p>
			</div>
			<Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}

function Field({ id, label, help, children }: { id: string; label: string; help: string; children: React.ReactNode }) {
	return (
		<div className='space-y-2'>
			<Label htmlFor={id}>{label}</Label>
			{children}
			<p className='text-xs text-muted-foreground'>{help}</p>
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
