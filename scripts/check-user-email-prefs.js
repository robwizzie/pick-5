/**
 * Check user email preferences in MongoDB
 * Usage: node scripts/check-user-email-prefs.js
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
	pushNotificationsEnabled: Boolean
});

const User = mongoose.model('User', UserSchema);

async function checkEmailPreferences() {
	try {
		if (!process.env.MONGODB_URI) {
			console.error('❌ MONGODB_URI not found in environment variables');
			process.exit(1);
		}

		console.log('🔌 Connecting to MongoDB...');
		await mongoose.connect(process.env.MONGODB_URI);
		console.log('✅ Connected to MongoDB\n');

		// Count all users
		const totalUsers = await User.countDocuments();
		console.log(`📊 Total users in database: ${totalUsers}\n`);

		// Count users with emailPreferences field
		const usersWithPrefs = await User.countDocuments({
			emailPreferences: { $exists: true }
		});
		console.log(`✉️  Users with emailPreferences field: ${usersWithPrefs}`);

		// Count users WITHOUT emailPreferences field
		const usersWithoutPrefs = await User.countDocuments({
			emailPreferences: { $exists: false }
		});
		console.log(`⚠️  Users WITHOUT emailPreferences field: ${usersWithoutPrefs}\n`);

		// Count users with specific preferences enabled
		const pickRemindersEnabled = await User.countDocuments({
			'emailPreferences.pickReminders': true
		});
		console.log(`🔔 Users with pickReminders enabled: ${pickRemindersEnabled}`);

		const thursdayEnabled = await User.countDocuments({
			'emailPreferences.pickReminders': true,
			'emailPreferences.thursdayReminder': true
		});
		console.log(`🏈 Users with Thursday reminders enabled: ${thursdayEnabled}`);

		const saturdayEnabled = await User.countDocuments({
			'emailPreferences.pickReminders': true,
			'emailPreferences.saturdayReminder': true
		});
		console.log(`⏰ Users with Saturday reminders enabled: ${saturdayEnabled}`);

		const weeklyScoreEnabled = await User.countDocuments({
			'emailPreferences.weeklyScoreEmail': true
		});
		console.log(`📊 Users with weekly score emails enabled: ${weeklyScoreEnabled}\n`);

		// Get sample of users (first 10)
		console.log('👥 Sample of users (showing first 10):\n');
		const sampleUsers = await User.find()
			.limit(10)
			.select('email name emailPreferences pushNotificationsEnabled')
			.lean();

		sampleUsers.forEach((user, index) => {
			console.log(`${index + 1}. ${user.email}`);
			console.log(`   Name: ${user.name || 'Not set'}`);
			if (user.emailPreferences) {
				console.log(`   Pick Reminders: ${user.emailPreferences.pickReminders ? '✅' : '❌'}`);
				console.log(`   Thursday: ${user.emailPreferences.thursdayReminder ? '✅' : '❌'} (${user.emailPreferences.thursdayReminderTime || 'not set'})`);
				console.log(`   Saturday: ${user.emailPreferences.saturdayReminder ? '✅' : '❌'} (${user.emailPreferences.saturdayReminderTime || 'not set'})`);
				console.log(`   Weekly Score: ${user.emailPreferences.weeklyScoreEmail ? '✅' : '❌'}`);
			} else {
				console.log(`   ⚠️  No email preferences set!`);
			}
			console.log(`   Push Notifications: ${user.pushNotificationsEnabled ? '✅' : '❌'}`);
			console.log('');
		});

		await mongoose.disconnect();
		console.log('👋 Disconnected from MongoDB');
	} catch (error) {
		console.error('❌ Error:', error);
		process.exit(1);
	}
}

checkEmailPreferences();
