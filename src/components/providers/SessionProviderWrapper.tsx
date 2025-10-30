// src/components/providers/SessionProviderWrapper.tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import React from 'react';

interface SessionProviderWrapperProps {
	children: React.ReactNode;
}

const SessionProviderWrapper: React.FC<SessionProviderWrapperProps> = ({ children }) => {
	return (
		<SessionProvider basePath='/api/auth' refetchInterval={0} refetchOnWindowFocus={false}>
			{children}
		</SessionProvider>
	);
};

export default SessionProviderWrapper;
