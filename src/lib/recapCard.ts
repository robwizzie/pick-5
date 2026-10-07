'use client';

// Shareable weekly recap image, drawn on a canvas in the browser (no server rendering needed).
// 1080×1350 (4:5) fits group chats and social feeds.

export interface RecapCardData {
	leagueName: string;
	week: number;
	winner: { name: string; points: number; correct: number } | null;
	/** Up to 5 "label: line" award rows */
	rows: Array<{ emoji: string; label: string; text: string }>;
	/** e.g. pick5.app */
	site: string;
}

const W = 1080;
const H = 1350;
const FONT = '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif';
const BODY = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise(resolve => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = src;
	});
}

/** Shrink the font until `text` fits `maxWidth`. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, weight: string, size: number, family: string, min = 28) {
	let s = size;
	ctx.font = `${weight} ${s}px ${family}`;
	while (ctx.measureText(text).width > maxWidth && s > min) {
		s -= 2;
		ctx.font = `${weight} ${s}px ${family}`;
	}
	return s;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
	if (ctx.measureText(text).width <= maxWidth) return text;
	let t = text;
	while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
	return `${t}…`;
}

export async function renderRecapCard(data: RecapCardData): Promise<Blob> {
	const canvas = document.createElement('canvas');
	canvas.width = W;
	canvas.height = H;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas not supported');

	// Background: deep navy with brand glows
	ctx.fillStyle = '#070b14';
	ctx.fillRect(0, 0, W, H);
	const glow = (x: number, y: number, r: number, color: string) => {
		const g = ctx.createRadialGradient(x, y, 0, x, y, r);
		g.addColorStop(0, color);
		g.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, W, H);
	};
	glow(W - 120, 160, 520, 'rgba(255,214,107,0.22)');
	glow(80, H - 120, 560, 'rgba(56,214,255,0.18)');
	glow(W / 2, H / 2, 700, 'rgba(255,61,90,0.06)');

	// Header: logo + league + week
	const logo = await loadImage('/pick-5-logo-sm.webp');
	if (logo) ctx.drawImage(logo, 72, 64, 88, 100);
	ctx.fillStyle = '#ffffff';
	ctx.textBaseline = 'alphabetic';
	fitText(ctx, data.leagueName.toUpperCase(), W - 72 - 190, 'italic 800', 52, FONT);
	ctx.fillText(ellipsize(ctx, data.leagueName.toUpperCase(), W - 72 - 190), 186, 118);
	ctx.fillStyle = '#38d6ff';
	ctx.font = `700 30px ${BODY}`;
	ctx.fillText(`WEEK ${data.week} RECAP`, 188, 160);

	// Winner block
	let y = 300;
	ctx.fillStyle = '#ffd66b';
	ctx.font = `700 30px ${BODY}`;
	ctx.fillText('👑  WEEK WINNER', 72, y);
	if (data.winner) {
		y += 120;
		ctx.fillStyle = '#ffffff';
		fitText(ctx, data.winner.name.toUpperCase(), 640, 'italic 900', 120, FONT, 56);
		ctx.fillText(ellipsize(ctx, data.winner.name.toUpperCase(), 640), 72, y);
		ctx.textAlign = 'right';
		ctx.fillStyle = '#ffd66b';
		ctx.font = `italic 900 170px ${FONT}`;
		ctx.fillText(String(data.winner.points), W - 72, y + 8);
		ctx.font = `700 26px ${BODY}`;
		ctx.fillText('POINTS', W - 76, y + 48);
		ctx.textAlign = 'left';
		ctx.fillStyle = 'rgba(255,255,255,0.6)';
		ctx.font = `600 30px ${BODY}`;
		ctx.fillText(`${data.winner.correct}/5 correct`, 74, y + 52);
		y += 120;
	}

	// Award rows
	y = Math.max(y, 560);
	const rowH = 132;
	for (const row of data.rows.slice(0, 5)) {
		ctx.fillStyle = 'rgba(255,255,255,0.05)';
		ctx.beginPath();
		ctx.roundRect(56, y, W - 112, rowH - 20, 28);
		ctx.fill();
		ctx.font = `64px ${BODY}`;
		ctx.fillText(row.emoji, 88, y + 78);
		ctx.fillStyle = 'rgba(255,255,255,0.55)';
		ctx.font = `700 24px ${BODY}`;
		ctx.fillText(row.label.toUpperCase(), 190, y + 44);
		ctx.fillStyle = '#ffffff';
		ctx.font = `600 36px ${BODY}`;
		ctx.fillText(ellipsize(ctx, row.text, W - 112 - 170), 190, y + 88);
		y += rowH;
	}

	// Footer
	ctx.fillStyle = 'rgba(255,255,255,0.45)';
	ctx.font = `600 28px ${BODY}`;
	ctx.textAlign = 'center';
	ctx.fillText(`Make your picks at ${data.site}`, W / 2, H - 56);

	return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Couldn’t create the image'))), 'image/png'));
}

/** Share the card through the OS share sheet when possible, otherwise download it. */
export async function shareRecapCard(data: RecapCardData): Promise<'shared' | 'downloaded'> {
	const blob = await renderRecapCard(data);
	const file = new File([blob], `pick5-week-${data.week}-recap.png`, { type: 'image/png' });
	if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
		try {
			await navigator.share({ files: [file], title: `${data.leagueName} · Week ${data.week} recap` });
			return 'shared';
		} catch (error) {
			// Dismissing the share sheet isn't a failure
			if ((error as Error)?.name === 'AbortError') return 'shared';
		}
	}
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = file.name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 2000);
	return 'downloaded';
}
