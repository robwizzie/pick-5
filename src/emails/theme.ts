/**
 * Design tokens for transactional emails — mirrors the site's "prime-time broadcast" theme
 * (see tailwind.config.ts / src/styles/globals.css). Email clients need literal hex values,
 * so the CSS variables are flattened here.
 */

export const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.sportspick5.com';

export const colors = {
	page: '#07090e',
	card: '#0f1219',
	cardRaised: '#141820',
	border: '#1f2430', // ≈ rgba(255,255,255,0.08) over the card surface (solid so Outlook renders it)
	borderStrong: '#2a3040',

	text: '#f4f6fb',
	textSoft: '#c9cfdb',
	muted: '#949bab',
	faint: '#6b7282',

	primary: '#38D6FF',
	primaryInk: '#07090e',
	win: '#7CFF4F',
	loss: '#FF3D5A',
	warn: '#FFB547',

	gold: '#FFD66B',
	silver: '#D5DCE6',
	bronze: '#E7A16B',

	// Tinted surfaces (pre-blended over the card color so they work without rgba support)
	primaryTint: '#0f2531',
	winTint: '#142a17',
	lossTint: '#2a121a',
	warnTint: '#2a2216'
} as const;

/** Brand gradient stops (logo colors), left → right. */
export const brandStripe = ['#7CFF4F', '#38D6FF', '#FF3D5A', '#FF7A30'] as const;

export const fonts = {
	display: "'Barlow Condensed','Arial Narrow','Helvetica Neue',Arial,sans-serif",
	body: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
} as const;

/** Shared style for the condensed, heavy, italic, uppercase broadcast face. */
export const display = {
	fontFamily: fonts.display,
	fontStyle: 'italic',
	fontWeight: 800,
	textTransform: 'uppercase',
	letterSpacing: '-0.01em'
} as const;

export const tabular = { fontVariantNumeric: 'tabular-nums' } as const;

export const rankColor = (rank: number): string =>
	rank === 1 ? colors.gold : rank === 2 ? colors.silver : rank === 3 ? colors.bronze : colors.muted;

export const ordinal = (n: number): string => {
	const mod100 = n % 100;
	if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
	switch (n % 10) {
		case 1:
			return `${n}st`;
		case 2:
			return `${n}nd`;
		case 3:
			return `${n}rd`;
		default:
			return `${n}th`;
	}
};

export const plural = (n: number, word: string, pluralWord = `${word}s`) => `${n} ${n === 1 ? word : pluralWord}`;

export const modeLabel = (mode: string | undefined) => (mode === 'steve' ? 'Steve Mode' : 'Standard Mode');
