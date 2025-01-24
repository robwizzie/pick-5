// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { MongoDBAdapter } from '@auth/mongodb-adapter';
import clientPromise from '@/lib/mongodb-adapter';

export const authOptions: NextAuthOptions = {
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_ID!,
			clientSecret: process.env.GOOGLE_SECRET!
		})
	],
	adapter: MongoDBAdapter(clientPromise),
	session: {
		strategy: 'jwt'
	},
	callbacks: {
		async session({ session, user }) {
			if (session?.user) {
				session.user.id = user.id;
			}
			return session;
		}
	}
};
