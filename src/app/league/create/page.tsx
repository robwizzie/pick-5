'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { FaFootballBall, FaBasketballBall, FaBaseballBall, FaHockeyPuck } from 'react-icons/fa';

export default function CreateLeaguePage() {
	const router = useRouter();
	const [selectedSport, setSelectedSport] = useState<string | null>(null);
	const [scoringMode, setScoringMode] = useState<'steve' | 'standard' | null>(null);
	const [leagueName, setLeagueName] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);

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
		<div className='h-[calc(100vh-4rem)] flex items-center justify-center'>
			<Card className='w-[500px] p-6'>
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
							{selectedSport === 'NFL' && (
								<Button className='w-full flex items-center justify-center gap-2' onClick={() => setScoringMode('steve')}>
									Steve Mode
								</Button>
							)}
							<Button variant='success' className='w-full flex items-center justify-center text-black gap-2' onClick={() => setScoringMode('standard')}>
								Standard Pick 5 Mode
							</Button>
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
		</div>
	);
}
