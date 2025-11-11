'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4 }}
			>
				<Card className='w-full max-w-[500px] p-6 bg-card/80 backdrop-blur-sm border-2 border-primary/20'>
					<CardHeader className='relative'>
						<Button variant='ghost' size='icon' className='absolute top-0 left-0 text-muted-foreground hover:text-primary hover:bg-transparent' onClick={handleBack}>
							<ArrowLeft className='w-5 h-5' />
						</Button>
						<CardTitle className='font-oswald text-xl uppercase tracking-wide text-primary text-center'>Create a League</CardTitle>
					</CardHeader>
					<CardContent className='space-y-4 mt-4'>
						{error && (
							<motion.div
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.3 }}
							>
								<Alert variant='destructive'>
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							</motion.div>
						)}

						{/* Sport Selection */}
						{!selectedSport && (
							<motion.div
								className='grid grid-cols-2 gap-4'
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ duration: 0.3, delay: 0.1 }}
							>
								{sports.map((sport, index) => (
									<motion.div
										key={sport.name}
										initial={{ opacity: 0, scale: 0.9 }}
										animate={{ opacity: 1, scale: 1 }}
										transition={{ duration: 0.3, delay: index * 0.1 }}
									>
										<Button
											key={sport.name}
											className='flex items-center justify-center gap-2 w-full'
											onClick={() => setSelectedSport(sport.name)}
											disabled={sport.name !== 'NFL'}
										>
											<sport.icon className='w-6 h-6' /> {sport.name}
											{sport.name !== 'NFL' && <span className='text-xs'>(Coming Soon)</span>}
										</Button>
									</motion.div>
								))}
							</motion.div>
						)}

					{/* Scoring Mode Selection */}
					{selectedSport && !scoringMode && (
						<motion.div
							className='space-y-4'
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.3 }}
						>
							<p className='text-sm text-center text-muted-foreground mb-2'>Choose your scoring system:</p>
							{selectedSport === 'NFL' && (
								<motion.div
									className='relative'
									initial={{ opacity: 0, x: -10 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ duration: 0.3, delay: 0.1 }}
								>
									<Button
										className='w-full flex items-center justify-center gap-2 pr-12'
										onClick={() => setScoringMode('steve')}
									>
										Steve Mode
									</Button>
									<button
										type='button'
										className='absolute top-1/2 -translate-y-1/2 right-2 h-8 w-8 p-0 rounded-md hover:bg-primary/20 flex items-center justify-center transition-colors'
										onClick={e => {
											e.stopPropagation();
											setShowModeInfo('steve');
										}}
									>
										<Info className='h-4 w-4' />
									</button>
								</motion.div>
							)}
							<motion.div
								className='relative'
								initial={{ opacity: 0, x: -10 }}
								animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.3, delay: selectedSport === 'NFL' ? 0.2 : 0.1 }}
							>
								<Button
									variant='success'
									className='w-full flex items-center justify-center text-black gap-2 pr-12'
									onClick={() => setScoringMode('standard')}
								>
									Standard Mode
								</Button>
								<button
									type='button'
									className='absolute top-1/2 -translate-y-1/2 right-2 h-8 w-8 p-0 rounded-md hover:bg-black/20 flex items-center justify-center transition-colors text-black'
									onClick={e => {
										e.stopPropagation();
										setShowModeInfo('standard');
									}}
								>
									<Info className='h-4 w-4' />
								</button>
							</motion.div>
						</motion.div>
					)}

					{/* League Details */}
					{selectedSport && scoringMode && (
						<motion.div
							className='space-y-4'
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.3 }}
						>
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, delay: 0.1 }}
							>
								<Input placeholder='League Name' value={leagueName} onChange={e => setLeagueName(e.target.value)} />
							</motion.div>
							<motion.div
								className='relative'
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, delay: 0.2 }}
							>
								<Input type={showPassword ? 'text' : 'password'} placeholder='League Password' value={password} onChange={e => setPassword(e.target.value)} />
								<Button variant='ghost' size='icon' className='absolute top-1/2 right-0 -translate-y-1/2 text-muted-foreground hover:text-primary hover:bg-transparent' onClick={() => setShowPassword(!showPassword)}>
									{showPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
								</Button>
							</motion.div>
							<motion.div
								initial={{ opacity: 0, y: 10 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, delay: 0.3 }}
							>
								<Button
									className='w-full mt-5'
									onClick={e => {
										e.preventDefault(); // Prevent form submission
										handleCreateLeague();
									}}>
									Create League
								</Button>
							</motion.div>
						</motion.div>
					)}
				</CardContent>
				</Card>
			</motion.div>

			{/* Mode Info Dialog */}
			<Dialog open={showModeInfo !== null} onOpenChange={() => setShowModeInfo(null)}>
				<DialogContent className='glass border-primary/20 backdrop-blur-xl sm:max-w-lg max-h-[80vh] overflow-y-auto'>
					<DialogHeader>
						<DialogTitle className='text-2xl font-bold text-primary'>{showModeInfo === 'steve' ? 'Steve Mode' : 'Standard Mode'}</DialogTitle>
						<DialogDescription className='text-muted-foreground'>{showModeInfo === 'steve' ? 'Simple Pick 5 with TFS Bonus' : 'Moneyline-Based Scoring'}</DialogDescription>
					</DialogHeader>

					<div className='space-y-4 py-4'>
						{showModeInfo === 'steve' ? (
							<>
								<div className='space-y-3'>
									<h3 className='text-lg font-semibold text-primary'>Overview</h3>
									<p className='text-sm text-muted-foreground'>Pick 5 winners each week plus predict a Total Final Score (TFS) for bonus points. Simple, straightforward scoring!</p>
								</div>

								<div className='p-4 rounded-lg bg-card border border-primary/20'>
									<h4 className='text-sm font-semibold text-foreground mb-2'>Scoring:</h4>
									<ul className='space-y-2 text-sm text-muted-foreground'>
										<li>• <span className='text-foreground font-semibold'>2 points</span> for each correct pick</li>
										<li>• <span className='text-foreground font-semibold'>0-5 bonus points</span> for TFS accuracy</li>
										<li>• <span className='text-foreground font-semibold'>Max 15 points</span> per week (10 from picks + 5 from TFS)</li>
									</ul>
								</div>

								<div className='p-4 rounded-lg bg-card border border-primary/20'>
									<h4 className='text-sm font-semibold text-foreground mb-2'>What is TFS?</h4>
									<p className='text-sm text-muted-foreground mb-2'>
										<strong className='text-foreground'>Total Final Score</strong> - Pick one game and predict the combined score of both teams.
									</p>
									<ul className='space-y-1 text-sm text-muted-foreground'>
										<li>• Exact match: <span className='text-foreground font-semibold'>5 pts</span></li>
										<li>• Within 3 points: <span className='text-foreground font-semibold'>4 pts</span></li>
										<li>• Within 5 points: <span className='text-foreground font-semibold'>3 pts</span></li>
										<li>• Within 7 points: <span className='text-foreground font-semibold'>2 pts</span></li>
										<li>• Within 10 points: <span className='text-foreground font-semibold'>1 pt</span></li>
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
									<p className='text-sm text-muted-foreground'>Pick 5 winners each week with points based on moneyline odds. Bigger underdogs = more points when you win!</p>
								</div>

								<div className='p-4 rounded-lg bg-card border border-primary/20'>
									<h4 className='text-sm font-semibold text-foreground mb-2'>Scoring Examples:</h4>
									<ul className='space-y-2 text-sm text-muted-foreground'>
										<li>• Heavy favorite (-300): <span className='text-foreground font-semibold'>1 point</span></li>
										<li>• Favorite (-150): <span className='text-foreground font-semibold'>2 points</span></li>
										<li>• Even odds (±110): <span className='text-foreground font-semibold'>2 points</span></li>
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
