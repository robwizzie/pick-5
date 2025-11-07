'use client';

import { useEffect } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from './button';

interface ToastProps {
	message: string;
	type?: 'success' | 'error' | 'info';
	onClose: () => void;
	duration?: number;
}

export function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
	useEffect(() => {
		const timer = setTimeout(() => {
			onClose();
		}, duration);

		return () => clearTimeout(timer);
	}, [duration, onClose]);

	const bgColor = type === 'success' ? 'bg-green-500/20 border-green-500/50' : type === 'error' ? 'bg-red-500/20 border-red-500/50' : 'bg-blue-500/20 border-blue-500/50';
	const textColor = type === 'success' ? 'text-green-400' : type === 'error' ? 'text-red-400' : 'text-blue-400';
	const Icon = type === 'success' ? CheckCircle2 : type === 'error' ? AlertCircle : CheckCircle2;

	return (
		<div className={`fixed top-24 right-4 z-[150] flex items-center gap-3 px-4 py-3 rounded-lg border-2 ${bgColor} ${textColor} shadow-lg animate-in slide-in-from-top-5 fade-in-0`}>
			<Icon className='h-5 w-5 flex-shrink-0' />
			<span className='font-medium'>{message}</span>
			<Button variant='ghost' size='icon' onClick={onClose} className='h-6 w-6 ml-2 text-current hover:bg-current/20'>
				<X className='h-4 w-4' />
			</Button>
		</div>
	);
}

