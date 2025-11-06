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
		async signIn({ user }) {
			// Connect to DB and create/update user
			await connectDB();

			const existingUser = await User.findOne({ email: user.email });

			if (!existingUser) {
				// Create new user with Google OAuth data
				const newUser = await User.create({
					email: user.email,
					name: user.name,
					image: user.image,
					emailVerified: new Date()
				});
				user.id = newUser._id.toString();
			} else {
				// For existing users, only update the ID and timestamp
				// DO NOT overwrite name/image - user may have customized these in settings
				user.id = existingUser._id.toString();
				await User.findByIdAndUpdate(existingUser._id, {
					updatedAt: new Date()
					// Removed: name and image update to preserve user customizations
				});
			}

			return true;
		},
		async session({ session, token }) {
			if (session?.user && token?.sub) {
				// Fetch fresh user data from database to get custom name/image
				await connectDB();
				const dbUser = await User.findById(token.sub);

				if (dbUser) {
					session.user.id = token.sub;
					session.user.name = dbUser.name;
					session.user.email = dbUser.email;
					session.user.image = dbUser.image;
				} else {
					session.user.id = token.sub;
				}
			}
			return session;
		},
		async jwt({ token, user }) {
			if (user) {
				token.sub = user.id;
			}
			return token;
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
