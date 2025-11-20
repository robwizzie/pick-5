// Service Worker for Pick 5 PWA Push Notifications

self.addEventListener('push', function (event) {
	if (!event.data) {
		console.log('Push event but no data');
		return;
	}

	let data;
	try {
		data = event.data.json();
	} catch (e) {
		console.error('Error parsing push data:', e);
		return;
	}

	const title = data.title || 'Pick 5';
	const options = {
		body: data.body,
		icon: '/pick-5-logo.png',
		badge: '/pick-5-logo.png',
		data: {
			url: data.url || '/',
			leagueIds: data.leagueIds || []
		},
		vibrate: [200, 100, 200],
		tag: data.tag || 'pick-reminder',
		// Pick reminders should persist until user interacts
		requireInteraction: data.tag === 'pick-reminder',
		// Make the notification sticky
		silent: false,
		renotify: true
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
	event.notification.close();

	const urlToOpen = event.notification.data?.url || '/';

	event.waitUntil(
		clients
			.matchAll({
				type: 'window',
				includeUncontrolled: true
			})
			.then(function (clientList) {
				// If a window is already open, focus it
				for (let i = 0; i < clientList.length; i++) {
					const client = clientList[i];
					if (client.url === urlToOpen && 'focus' in client) {
						return client.focus();
					}
				}
				// Otherwise, open a new window
				if (clients.openWindow) {
					return clients.openWindow(urlToOpen);
				}
			})
	);
});

// Install and activate events for service worker lifecycle
self.addEventListener('install', function (event) {
	console.log('Service Worker installing.');
	self.skipWaiting();
});

self.addEventListener('activate', function (event) {
	console.log('Service Worker activating.');
	event.waitUntil(clients.claim());
});
