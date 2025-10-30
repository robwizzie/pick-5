// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

export const authOptions: NextAuthOptions = {
	providers: [
		GoogleProvider({
			clientId: process.env.GOOGLE_ID!,
			clientSecret: process.env.GOOGLE_SECRET!
		})
	],
	secret: process.env.NEXTAUTH_SECRET,
	pages: {
		signIn: '/login',
		error: '/login'
	},
	session: {
		strategy: 'jwt'
	},
    debug: false,
	callbacks: {
		async signIn({ user, account, profile }) {
			// Connect to DB and create/update user
			await connectDB();

			const existingUser = await User.findOne({ email: user.email });

			if (!existingUser) {
				// Create new user
				const newUser = await User.create({
					email: user.email,
					name: user.name,
					image: user.image,
					emailVerified: new Date()
				});
				user.id = newUser._id.toString();
			} else {
				// Update existing user
				user.id = existingUser._id.toString();
				await User.findByIdAndUpdate(existingUser._id, {
					name: user.name,
					image: user.image,
					updatedAt: new Date()
				});
			}

			return true;
		},
		async session({ session, token }) {
			if (session?.user && token?.sub) {
				session.user.id = token.sub;
			}
			return session;
		},
		async jwt({ token, user }) {
			if (user) {
				token.sub = user.id;
			}
			return token;
		},
        async signIn() {
            return true;
        },
        async redirect({ url, baseUrl }) {
			// Allows relative callback URLs
			if (url.startsWith('/')) return `${baseUrl}${url}`;
			// Allows callback URLs on the same origin
			else if (new URL(url).origin === baseUrl) return url;
			return baseUrl;
		}
	}
};
