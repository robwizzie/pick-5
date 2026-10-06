// Service worker for Pick 5 push notifications.
// Payload (JSON): { title, body, url, tag, requireInteraction?, leagueId?, leagueIds? }

self.addEventListener('push', function (event) {
	if (!event.data) return;

	let data;
	try {
		data = event.data.json();
	} catch (e) {
		data = { body: event.data.text() };
	}

	const tag = typeof data.tag === 'string' && data.tag ? data.tag : undefined;
	const options = {
		body: data.body || '',
		icon: '/icon-192.png',
		// Small monochrome glyph for the Android status bar.
		badge: '/badge-72.png',
		data: {
			url: data.url || '/',
			leagueIds: data.leagueIds || []
		},
		vibrate: [200, 100, 200]
	};
	// renotify/requireInteraction are only valid together with a tag (some browsers throw
	// on renotify without one).
	if (tag) {
		options.tag = tag;
		options.renotify = true;
		if (data.requireInteraction) options.requireInteraction = true;
	}

	event.waitUntil(self.registration.showNotification(data.title || 'Pick 5', options));
});

self.addEventListener('notificationclick', function (event) {
	event.notification.close();

	const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin);
	if (target.origin !== self.location.origin) return;

	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
			const sameOrigin = clientList.filter(function (client) {
				return new URL(client.url).origin === self.location.origin;
			});
			// Reuse an open Pick 5 window (exact match first), navigating it to the target.
			const client =
				sameOrigin.find(function (c) {
					return c.url === target.href;
				}) || sameOrigin[0];
			if (client) {
				return client.focus().then(function (focused) {
					const win = focused || client;
					if (win.url !== target.href && 'navigate' in win) {
						return win.navigate(target.href).catch(function () {
							return clients.openWindow(target.href);
						});
					}
					return win;
				});
			}
			return clients.openWindow(target.href);
		})
	);
});

self.addEventListener('install', function () {
	self.skipWaiting();
});

self.addEventListener('activate', function (event) {
	event.waitUntil(clients.claim());
});
