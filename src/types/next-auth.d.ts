// src/types/next-auth.d.ts
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
	interface Session {
		user: {
			id: string;
			totalPoints: number;
			correctPicks: number;
			totalPicks: number;
			tfsPoints: number;
		} & DefaultSession['user'];
	}
}
