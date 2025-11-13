/**
 * Add default email preferences to users who don't have them
 * Usage: node scripts/fix-user-email-prefs.js
 */

const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const UserSchema = new mongoose.Schema({
	name: String,
	email: String,
	emailPreferences: {
		pickReminders: Boolean,
		thursdayReminder: Boolean,
		saturdayReminder: Boolean,
		weeklyScoreEmail: Boolean,
		thursdayReminderTime: String,
		saturdayReminderTime: String
	},
	pushNotificationsEnabled: Boolean,
	unsubscribeToken: String
});

const User = mongoose.model('User', UserSchema);

async function fixEmailPreferences() {
	try {
		if (!process.env.MONGODB_URI) {
			console.error('❌ MONGODB_URI not found in environment variables');
			process.exit(1);
		}

		console.log('🔌 Connecting to MongoDB...');
		await mongoose.connect(process.env.MONGODB_URI);
		console.log('✅ Connected to MongoDB\n');

		// Find users without emailPreferences
		const usersWithoutPrefs = await User.find({
			emailPreferences: { $exists: false }
		});

		console.log(`Found ${usersWithoutPrefs.length} users without email preferences\n`);

		if (usersWithoutPrefs.length === 0) {
			console.log('✅ All users already have email preferences set!');
			await mongoose.disconnect();
			return;
		}

		console.log('📝 Adding default email preferences to users...\n');

		let updated = 0;
		for (const user of usersWithoutPrefs) {
			try {
				await User.updateOne(
					{ _id: user._id },
					{
						$set: {
							emailPreferences: {
								pickReminders: true,
								thursdayReminder: true,
								saturdayReminder: true,
								weeklyScoreEmail: true,
								thursdayReminderTime: '13:00', // 1:00 PM
								saturdayReminderTime: '12:00' // 12:00 PM
							}
						}
					}
				);
				console.log(`✅ Updated: ${user.email}`);
				updated++;
			} catch (error) {
				console.error(`❌ Failed to update ${user.email}:`, error.message);
			}
		}

		console.log(`\n✅ Successfully updated ${updated} users`);
		console.log(`❌ Failed to update ${usersWithoutPrefs.length - updated} users\n`);

		// Verify the update
		const remainingWithoutPrefs = await User.countDocuments({
			emailPreferences: { $exists: false }
		});

		console.log(`📊 Users still without preferences: ${remainingWithoutPrefs}`);

		const totalWithThursdayEnabled = await User.countDocuments({
			'emailPreferences.pickReminders': true,
			'emailPreferences.thursdayReminder': true
		});

		console.log(`🏈 Users now eligible for Thursday reminders: ${totalWithThursdayEnabled}`);

		await mongoose.disconnect();
		console.log('\n👋 Disconnected from MongoDB');
	} catch (error) {
		console.error('❌ Error:', error);
		process.exit(1);
	}
}

fixEmailPreferences();
