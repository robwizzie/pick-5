// src/app/api/admin/nudge-report/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ADMIN_USER_ID } from '@/lib/constants';
import { getCurrentSeasonYear } from '@/lib/season';
import { getNudgeReport } from '@/lib/nudgeReport';

export const dynamic = 'force-dynamic';

/** GET /api/admin/nudge-report?season=2026 — whether nudges get picks made, by channel, vs. players not nudged. */
export async function GET(req: Request) {
	try {
		const session = await getServerSession(authOptions);
		if (!session?.user?.id || session.user.id !== ADMIN_USER_ID) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const param = Number(new URL(req.url).searchParams.get('season'));
		const season = Number.isInteger(param) && param > 2000 ? param : getCurrentSeasonYear();
		return NextResponse.json(await getNudgeReport(season));
	} catch (error) {
		console.error('[Nudge Report API] Error:', error);
		return NextResponse.json({ error: 'Failed to build nudge report' }, { status: 500 });
	}
}
