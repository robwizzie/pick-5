'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Eye, EyeOff, Info } from 'lucide-react';
import { FaFootballBall, FaBasketballBall, FaBaseballBall, FaHockeyPuck } from 'react-icons/fa';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export default function CreateLeaguePage() {
	const router = useRouter();
	const [selectedSport, setSelectedSport] = useState<string | null>(null);
	const [scoringMode, setScoringMode] = useState<'steve' | 'standard' | null>(null);
	const [leagueName, setLeagueName] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showModeInfo, setShowModeInfo] = useState<'steve' | 'standard' | null>(null);

	const sports = [
		{ name: 'NFL', icon: FaFootballBall },
		{ name: 'NBA', icon: FaBasketballBall },
		{ name: 'MLB', icon: FaBaseballBall },
		{ name: 'NHL', icon: FaHockeyPuck }
	];

	const handleBack = () => {
		if (scoringMode) {
			setScoringMode(null);
		} else if (selectedSport) {
			setSelectedSport(null);
		} else {
			router.push('/dashboard');
		}
	};

	const handleCreateLeague = async () => {
		if (!selectedSport || !scoringMode || !leagueName || !password) {
			setError('Please fill in all fields');
			return;
		}

		try {
			const response = await fetch('/api/league/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sport: selectedSport,
					scoringMode,
					name: leagueName,
					password
				})
			});

			if (response.ok) {
				router.push('/setup');
			} else {
				const errorData = await response.json();
				setError(errorData.message || 'Failed to create league');
			}
		} catch {
			setError('An unexpected error occurred');
		}
	};

	return (
		<div className='h-[calc(100vh-4rem)] flex items-center justify-center px-4'>
			<Card className='w-full max-w-[500px] p-6'>
				<CardHeader className='relative'>
					<Button variant='ghost' size='icon' className='absolute top-0 left-0 text-muted-foreground hover:text-primary hover:bg-transparent' onClick={handleBack}>
						<ArrowLeft className='w-5 h-5' />
					</Button>
					<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary text-center'>Create a League</CardTitle>
				</CardHeader>
				<CardContent className='space-y-4 mt-4'>
					{error && (
						<Alert variant='destructive'>
							<AlertDescription>{error}</AlertDescription>
						</Alert>
					)}

					{/* Sport Selection */}
					{!selectedSport && (
						<div className='grid grid-cols-2 gap-4'>
							{sports.map(sport => (
								<Button key={sport.name} className='flex items-center justify-center gap-2' onClick={() => setSelectedSport(sport.name)}>
									<sport.icon className='w-6 h-6' /> {sport.name}
								</Button>
							))}
						</div>
					)}

					{/* Scoring Mode Selection */}
					{selectedSport && !scoringMode && (
						<div className='space-y-4'>
							<p className='text-sm text-center text-muted-foreground mb-2'>Choose your scoring system:</p>
							{selectedSport === 'NFL' && (
								<div className='relative'>
									<Button className='w-full flex items-center justify-center gap-2' onClick={() => setScoringMode('steve')}>
										Steve Mode
									</Button>
									<Button variant='ghost' size='sm' className='absolute top-1/2 -translate-y-1/2 right-2 h-8 w-8 p-0 hover:bg-primary/20' onClick={e => {
										e.stopPropagation();
										setShowModeInfo('steve');
									}}>
										<Info className='h-4 w-4' />
									</Button>
								</div>
							)}
							<div className='relative'>
								<Button variant='success' className='w-full flex items-center justify-center text-black gap-2' onClick={() => setScoringMode('standard')}>
									Standard Mode
								</Button>
								<Button variant='ghost' size='sm' className='absolute top-1/2 -translate-y-1/2 right-2 h-8 w-8 p-0 hover:bg-primary/20 text-black' onClick={e => {
									e.stopPropagation();
									setShowModeInfo('standard');
								}}>
									<Info className='h-4 w-4' />
								</Button>
							</div>
						</div>
					)}

					{/* League Details */}
					{selectedSport && scoringMode && (
						<div className='space-y-4'>
							<Input placeholder='League Name' value={leagueName} onChange={e => setLeagueName(e.target.value)} />
							<div className='relative'>
								<Input type={showPassword ? 'text' : 'password'} placeholder='League Password' value={password} onChange={e => setPassword(e.target.value)} />
								<Button variant='ghost' size='icon' className='absolute top-1/2 right-0 -translate-y-1/2 text-muted-foreground hover:text-primary hover:bg-transparent' onClick={() => setShowPassword(!showPassword)}>
									{showPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
								</Button>
							</div>
							<Button
								className='w-full mt-5'
								onClick={e => {
									e.preventDefault(); // Prevent form submission
									handleCreateLeague();
								}}>
								Create League
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Mode Info Dialog */}
			<Dialog open={showModeInfo !== null} onOpenChange={() => setShowModeInfo(null)}>
				<DialogContent className='glass border-white/10 backdrop-blur-xl sm:max-w-lg max-h-[80vh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle className='text-2xl font-bold text-primary'>{showModeInfo === 'steve' ? 'Steve Mode' : 'Standard Mode'}</DialogTitle>
						<DialogDescription className='text-muted-foreground'>{showModeInfo === 'steve' ? 'Simple Pick 5 with TFS Bonus' : 'Moneyline-Based Scoring'}</DialogDescription>
					</DialogHeader>

					<div className='space-y-4 py-4'>
						{showModeInfo === 'steve' ? (
							<>
								<div className='space-y-3'>
									<h3 className='text-lg font-semibold text-primary'>Overview</h3>
									<p className='text-sm text-muted-foreground'>Pick 5 winners each week plus predict a Total Final Score for bonus points. Simple, straightforward scoring!</p>
								</div>

								<div className='p-4 rounded-lg bg-card border border-primary/20'>
									<h4 className='text-sm font-semibold text-foreground mb-2'>Scoring:</h4>
									<ul className='space-y-2 text-sm text-muted-foreground'>
										<li>• <span className='text-foreground font-semibold'>2 points</span> for each correct pick</li>
										<li>• <span className='text-foreground font-semibold'>0-5 bonus points</span> for TFS accuracy</li>
										<li>• <span className='text-foreground font-semibold'>Max 15 points</span> per week</li>
									</ul>
								</div>

								<div className='p-3 rounded-lg bg-primary/10 border border-primary/20'>
									<p className='text-sm text-foreground'>
										<strong>Best for:</strong> Players who want straightforward scoring without worrying about odds or risk management.
									</p>
								</div>
							</>
						) : (
							<>
								<div className='space-y-3'>
									<h3 className='text-lg font-semibold text-primary'>Overview</h3>
									<p className='text-sm text-muted-foreground'>Pick 5 winners each week with points based on betting odds. Bigger underdogs = more points when you win!</p>
								</div>

								<div className='p-4 rounded-lg bg-card border border-primary/20'>
									<h4 className='text-sm font-semibold text-foreground mb-2'>Scoring Examples:</h4>
									<ul className='space-y-2 text-sm text-muted-foreground'>
										<li>• Heavy favorite (-200): <span className='text-foreground font-semibold'>1 point</span></li>
										<li>• Even odds (±100): <span className='text-foreground font-semibold'>2 points</span></li>
										<li>• Underdog (+200): <span className='text-foreground font-semibold'>3 points</span></li>
										<li>• Big underdog (+400): <span className='text-foreground font-semibold'>5 points</span></li>
									</ul>
								</div>

								<div className='p-3 rounded-lg bg-primary/10 border border-primary/20'>
									<p className='text-sm text-foreground'>
										<strong>Best for:</strong> Players who enjoy risk/reward strategy and want to see live betting odds with each pick.
									</p>
								</div>
							</>
						)}

						<Button className='w-full mt-4' onClick={() => setShowModeInfo(null)}>
							Got it!
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
