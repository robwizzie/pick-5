# Database Scripts

## Setup

1. Create a `.env.local` file in the root directory with your MongoDB connection string:
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Check User Email Preferences

Check the current state of email preferences for all users:

```bash
node scripts/check-user-email-prefs.js
```

This will show:
- Total number of users
- How many users have email preferences set
- How many users are missing email preferences
- Count of users with each type of reminder enabled
- Sample of first 10 users with their preferences

## Fix Missing Email Preferences

Add default email preferences to users who don't have them:

```bash
node scripts/fix-user-email-prefs.js
```

This will:
- Find all users without `emailPreferences` field
- Add default preferences (all enabled) to those users
- Show a summary of updates

**Default preferences added:**
- Pick Reminders: ✅ Enabled
- Thursday Reminder: ✅ Enabled (1:00 PM)
- Saturday Reminder: ✅ Enabled (12:00 PM)
- Weekly Score Email: ✅ Enabled

## Recommended Workflow

1. First, check current state:
   ```bash
   node scripts/check-user-email-prefs.js
   ```

2. If you see users without preferences, fix them:
   ```bash
   node scripts/fix-user-email-prefs.js
   ```

3. Verify the fix worked:
   ```bash
   node scripts/check-user-email-prefs.js
   ```

4. Test email sending by running the cron job in Vercel dashboard
