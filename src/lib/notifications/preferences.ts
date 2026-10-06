// src/lib/notifications/preferences.ts
// Mongo filters for "who wants this notification". A preference that was never stored counts
// as on (the schema default), matching what /api/user/settings shows.

/** Pick reminder emails for `kind` (also gates push reminders, as before). */
export function reminderRecipientsFilter(kind: 'thursday' | 'saturday') {
	return {
		'emailPreferences.pickReminders': { $ne: false },
		[kind === 'thursday' ? 'emailPreferences.thursdayReminder' : 'emailPreferences.saturdayReminder']: { $ne: false }
	};
}

/**
 * Weekly score emails. Unset counts as on, except for accounts unsubscribed by the old
 * one-click link, which turned reminders off but left weeklyScoreEmail unset.
 */
export const scoreEmailRecipientsFilter = {
	$or: [
		{ 'emailPreferences.weeklyScoreEmail': true },
		{ 'emailPreferences.weeklyScoreEmail': { $exists: false }, 'emailPreferences.pickReminders': { $ne: false } }
	]
};
