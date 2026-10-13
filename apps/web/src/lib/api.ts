import { SessionClient } from '@checkout/client';

export const API_BASE_URL = import.meta.env.API_BASE_URL ?? 'http://localhost:3000';

export function serverApi(): SessionClient {
	return new SessionClient({ baseUrl: API_BASE_URL });
}
