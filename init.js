globalThis.serviceWorkerSections = {};
serviceWorkerSections.pong = function({ time }) {
	console.log('[SERVICE WORKER] PONG in ', (Date.now() - time) + 'ms');
}

globalThis.getPlanetMathFromServiceWorker = function(type, size) {
	return requestResponseFromServiceWorker('getPlanet', { type: type === 'GAS' ? 'gas' : 'any', size });
}

globalThis.getPlanetSharedBuffer = function() {
	return requestResponseFromServiceWorker('getPlanetSharedBuffer');
}

globalThis.pendingServiceWorkerRequests = {};
globalThis.requestResponseFromServiceWorker = function(section, data = {}) {
	const requestId = createRandomIdentifier();
	navigator.serviceWorker.controller.postMessage({ requestId, section, data });
	return new Promise(resolve => pendingServiceWorkerRequests[requestId] = resolve);
}
globalThis.serviceWorkerPush = function(section, data = {}) {
	navigator.serviceWorker.controller.postMessage({ section, data });
}

navigator.serviceWorker.addEventListener('message', event => {
	l('[SERVICE WORKER]', event);
	if (event.data.responseId) {
		pendingServiceWorkerRequests[event.data.responseId](event.data.data);
	} else if (event.data.section) {
		serviceWorkerSections[event.data.section](event.data);
	} else {
		console.error('Unknown service worker message:', event.data);
	}
});

async function registerServiceWorker() {
	if ('serviceWorker' in navigator) {
		try {
			l('>>>REGISTER SERVICE WORKER');
			const registration = await navigator.serviceWorker.register('./service-worker.js', {
				scope: '/',
				//type: 'module',
			});
			if (registration.installing) {
				console.log("Service worker installing");
			} else if (registration.waiting) {
				console.log("Service worker installed");
			} else if (registration.active) {
				console.log("Service worker active");
			}
			navigator.serviceWorker.ready.then((registration) => {
				l('SERVICE WORKER READY');
				registration.active.postMessage({
					section: 'ping',
				});
			});
		} catch (error) {
			console.error(`Registration of service worker failed with ${error}`);
		}
	} else {
		throw new Error('No service worker, no fun. Sorry.');
	}
};
registerServiceWorker();
