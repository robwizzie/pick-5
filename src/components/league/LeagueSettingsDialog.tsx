'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, UserMinus } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Pill } from '@/components/ui/page';

interface Member {
	_id: string;
	name: string;
	image: string | null;
}

export interface SettingsLeague {
	name: string;
	mode?: string;
	creatorId?: string;
}

const initials = (name: string) =>
	name
		.split(' ')
		.map(n => n[0])
		.join('')
		.toUpperCase()
		.slice(0, 2);

export function LeagueSettingsDialog({
	open,
	onOpenChange,
	leagueId,
	league,
	onSaved
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	leagueId: string;
	league: SettingsLeague;
	onSaved: (league: SettingsLeague) => void;
}) {
	const [tab, setTab] = useState<'general' | 'members'>('general');
	const [name, setName] = useState(league.name);
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [saving, setSaving] = useState(false);
	const [members, setMembers] = useState<Member[] | null>(null);
	const [removing, setRemoving] = useState<Member | null>(null);
	const [removeBusy, setRemoveBusy] = useState(false);

	const loadMembers = async () => {
		try {
			const res = await fetch(`/api/league/${leagueId}/members`);
			if (res.ok) setMembers(await res.json());
		} catch (error) {
			console.error('Error fetching members:', error);
		}
	};

	useEffect(() => {
		if (!open) return;
		setTab('general');
		setName(league.name);
		setPassword('');
		setShowPassword(false);
		setMembers(null);
		loadMembers();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const passwordTooShort = password.trim().length > 0 && password.trim().length < 4;

	const save = async () => {
		const update: { name?: string; password?: string } = {};
		if (name.trim() !== league.name) update.name = name.trim();
		if (password.trim()) update.password = password;
		if (!Object.keys(update).length) return onOpenChange(false);

		setSaving(true);
		try {
			const res = await fetch(`/api/league/${leagueId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(update)
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to update league settings');
			onSaved(data.league);
			toast.success(update.password ? 'Saved — the new password is live' : 'League settings saved');
			onOpenChange(false);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to update league settings');
		} finally {
			setSaving(false);
		}
	};

	const removeMember = async () => {
		if (!removing) return;
		setRemoveBusy(true);
		try {
			const res = await fetch(`/api/league/${leagueId}/members`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: removing._id })
			});
			if (!res.ok) throw new Error((await res.json()).error || 'Failed to remove member');
			toast.success(`${removing.name} was removed`);
			setRemoving(null);
			await loadMembers();
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to remove member');
		} finally {
			setRemoveBusy(false);
		}
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className='sm:max-w-lg'>
					<DialogHeader>
						<DialogTitle>League settings</DialogTitle>
						<DialogDescription>Only the commissioner can change these.</DialogDescription>
					</DialogHeader>

					<Tabs value={tab} onValueChange={v => setTab(v as 'general' | 'members')}>
						<TabsList className='grid w-full grid-cols-2'>
							<TabsTrigger value='general'>General</TabsTrigger>
							<TabsTrigger value='members'>Members{members ? ` (${members.length})` : ''}</TabsTrigger>
						</TabsList>

						<TabsContent value='general' className='space-y-5'>
							<div className='space-y-2'>
								<Label htmlFor='league-name'>League name</Label>
								<Input id='league-name' value={name} onChange={e => setName(e.target.value)} maxLength={100} />
								<p className='text-xs text-muted-foreground tabular'>{name.length}/100</p>
							</div>

							<div className='space-y-2'>
								<Label htmlFor='league-password'>New password</Label>
								<div className='relative'>
									<Input
										id='league-password'
										type={showPassword ? 'text' : 'password'}
										value={password}
										onChange={e => setPassword(e.target.value)}
										placeholder='Leave empty to keep the current one'
										className='pr-11'
										maxLength={50}
										aria-invalid={passwordTooShort}
									/>
									<button
										type='button'
										onClick={() => setShowPassword(s => !s)}
										className='absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground'
										aria-label={showPassword ? 'Hide password' : 'Show password'}
									>
										{showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
									</button>
								</div>
								<p className={passwordTooShort ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>At least 4 characters.</p>
							</div>

							<div className='flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3'>
								<div>
									<p className='text-sm font-semibold'>{league.mode === 'steve' ? 'Steve Mode' : 'Standard Mode'}</p>
									<p className='text-xs text-muted-foreground'>Scoring mode can’t be changed after creation.</p>
								</div>
								<Pill tone={league.mode === 'steve' ? 'accent' : 'primary'}>Locked</Pill>
							</div>

							<DialogFooter>
								<Button variant='ghost' onClick={() => onOpenChange(false)} disabled={saving}>
									Cancel
								</Button>
								<Button onClick={save} disabled={saving || !name.trim() || passwordTooShort}>
									{saving ? 'Saving…' : 'Save changes'}
								</Button>
							</DialogFooter>
						</TabsContent>

						<TabsContent value='members'>
							<p className='mb-3 text-sm text-muted-foreground'>Removing a member permanently deletes all of their picks in this league.</p>
							<div className='max-h-80 space-y-1 overflow-y-auto'>
								{members === null
									? [0, 1, 2].map(i => <Skeleton key={i} className='h-14 w-full' />)
									: members.map(member => {
											const isCommissioner = member._id === league.creatorId;
											return (
												<div key={member._id} className='flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/[0.04]'>
													<Avatar className='h-9 w-9 ring-1 ring-white/10'>
														<AvatarImage src={member.image || undefined} alt={member.name} />
														<AvatarFallback className='bg-primary/15 text-xs font-bold text-primary'>{initials(member.name)}</AvatarFallback>
													</Avatar>
													<span className='min-w-0 flex-1 truncate text-sm font-medium'>{member.name}</span>
													{isCommissioner ? (
														<Pill tone='primary'>Commish</Pill>
													) : (
														<Button variant='ghost' size='icon' className='h-8 w-8 text-muted-foreground hover:text-destructive' onClick={() => setRemoving(member)} aria-label={`Remove ${member.name}`}>
															<UserMinus />
														</Button>
													)}
												</div>
											);
										})}
							</div>
						</TabsContent>
					</Tabs>
				</DialogContent>
			</Dialog>

			<Dialog open={!!removing} onOpenChange={o => !o && setRemoving(null)}>
				<DialogContent className='sm:max-w-sm'>
					<DialogHeader>
						<DialogTitle>Remove {removing?.name}?</DialogTitle>
						<DialogDescription>They’ll be removed from the league and all of their picks here will be deleted. This can’t be undone.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant='ghost' onClick={() => setRemoving(null)} disabled={removeBusy}>
							Cancel
						</Button>
						<Button variant='destructive' onClick={removeMember} disabled={removeBusy}>
							{removeBusy ? 'Removing…' : 'Remove member'}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
