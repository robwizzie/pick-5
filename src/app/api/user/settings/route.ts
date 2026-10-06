import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

export const dynamic = 'force-dynamic';

const EMAIL_KEYS = ['pickReminders', 'thursdayReminder', 'saturdayReminder', 'weeklyScoreEmail'] as const;
const PUSH_KEYS = ['gameResults', 'weeklyRecap', 'pickReminders'] as const;

type Prefs<K extends string> = Record<K, boolean>;

/** Stored value, or the schema default (true) when the field was never set. */
function withDefaults<K extends string>(keys: readonly K[], stored: Partial<Record<K, boolean | null>> | undefined): Prefs<K> {
	return Object.fromEntries(keys.map(k => [k, stored?.[k] ?? true])) as Prefs<K>;
}

/** `$set` paths for the boolean fields present in `input`; anything else is ignored. */
function booleanUpdates(prefix: string, keys: readonly string[], input: unknown): Record<string, boolean> {
	if (!input || typeof input !== 'object') return {};
	const out: Record<string, boolean> = {};
	for (const key of keys) {
		const value = (input as Record<string, unknown>)[key];
		if (typeof value === 'boolean') out[`${prefix}.${key}`] = value;
	}
	return out;
}

interface LeanSettings {
	emailPreferences?: Partial<Prefs<(typeof EMAIL_KEYS)[number]>>;
	pushNotificationsEnabled?: boolean;
	pushNotificationPreferences?: Partial<Prefs<(typeof PUSH_KEYS)[number]>>;
}

function toResponse(user: LeanSettings) {
	const emailPreferences = withDefaults(EMAIL_KEYS, user.emailPreferences);
	// Accounts unsubscribed by the old one-click link have weeklyScoreEmail unset and reminders
	// off; they get no score emails (see src/lib/notifications/preferences.ts), so show it off.
	if (user.emailPreferences?.weeklyScoreEmail == null && user.emailPreferences?.pickReminders === false) {
		emailPreferences.weeklyScoreEmail = false;
	}
	return {
		emailPreferences,
		pushNotificationsEnabled: user.pushNotificationsEnabled || false,
		pushNotificationPreferences: withDefaults(PUSH_KEYS, user.pushNotificationPreferences)
	};
}

const SETTINGS_FIELDS = 'emailPreferences pushNotificationsEnabled pushNotificationPreferences';

// GET user settings
export async function GET() {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		await connectDB();
		const user = (await User.findById(session.user.id).select(SETTINGS_FIELDS).lean()) as LeanSettings | null;
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		return NextResponse.json(toResponse(user));
	} catch (error: unknown) {
		console.error('Error fetching user settings:', error);
		return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
	}
}

// POST update user settings (partial: only boolean fields that are present are changed)
export async function POST(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		let body: Record<string, unknown>;
		try {
			body = await req.json();
		} catch {
			return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
		}

		const $set: Record<string, unknown> = {
			...booleanUpdates('emailPreferences', EMAIL_KEYS, body.emailPreferences),
			...booleanUpdates('pushNotificationPreferences', PUSH_KEYS, body.pushNotificationPreferences),
			updatedAt: new Date()
		};
		if (typeof body.pushNotificationsEnabled === 'boolean') {
			$set.pushNotificationsEnabled = body.pushNotificationsEnabled;
		}

		await connectDB();
		const user = (await User.findByIdAndUpdate(session.user.id, { $set }, { new: true })
			.select(SETTINGS_FIELDS)
			.lean()) as LeanSettings | null;
		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		return NextResponse.json({ success: true, message: 'Settings updated successfully', ...toResponse(user) });
	} catch (error: unknown) {
		console.error('Error updating user settings:', error);
		return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
	}
}
