// src/lib/mongodb.ts
import mongoose from 'mongoose';

if (!process.env.MONGODB_URI) {
	throw new Error('Please add your MongoDB URI to .env.local');
}

export const connectToDb = async () => {
	try {
		const { connection } = await mongoose.connect(process.env.MONGODB_URI!);
		if (connection.readyState === 1) {
			return Promise.resolve(true);
		}
	} catch (error) {
		return Promise.reject(error);
	}
};
