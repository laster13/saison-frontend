import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private'; // variables privées (.env)
import { env as publicEnv } from '$env/dynamic/public'; // variables publiques (.env)

// 🔹 Utilise la variable déjà définie dans .env.production
const BACKEND_URL = publicEnv.VITE_API_BASE_URL || env.VITE_API_BASE_URL || 'http://localhost:8080';

/**
 * Proxy pour toutes les requêtes /api -> backend
 */
const handleProxy = async ({ event, resolve }) => {
	if (event.url.pathname.startsWith('/api')) {
		const backendResponse = await fetch(
			BACKEND_URL + event.url.pathname.replace(/^\/api\/v1/, '') + event.url.search,
			{
				method: event.request.method,
				headers: event.request.headers,
				body:
					event.request.method !== 'GET' && event.request.method !== 'HEAD'
						? await event.request.arrayBuffer()
						: undefined
			}
		);

		return new Response(await backendResponse.arrayBuffer(), {
			status: backendResponse.status,
			headers: backendResponse.headers
		});
	}

	return resolve(event);
};

// 🔹 Sans paraglide
export const handle = handleProxy;
