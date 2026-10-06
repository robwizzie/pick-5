'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';

interface ToastProps {
	message: string;
	type?: 'success' | 'error' | 'info';
	onClose: () => void;
	duration?: number;
}

/**
 * Declarative bridge to the global Sonner toaster mounted in the root layout.
 * Rendering <Toast /> fires a toast once, then hands control back via onClose.
 */
export function Toast({ message, type = 'success', onClose, duration = 3000 }: ToastProps) {
	useEffect(() => {
		const show = type === 'error' ? toast.error : type === 'info' ? toast.info : toast.success;
		show(message, { duration });
		onClose();
		// Fire once per message
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [message, type]);

	return null;
}
