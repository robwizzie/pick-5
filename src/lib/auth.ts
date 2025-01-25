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
	secret: process.env.NEXTAUTH_SECRET,
	pages: {
		signIn: '/auth/signin'
	},
	session: {
		strategy: 'jwt'
	},
	callbacks: {
		session: async ({ session, token }) => {
			if (session?.user && token?.sub) {
				session.user.id = token.sub;
			}
			return session;
		},
		jwt: async ({ token, user }) => {
			if (user) {
				token.id = user.id;
			}
			return token;
		}
	}
};
