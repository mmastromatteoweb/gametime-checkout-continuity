export type SessionState =
	| 'active'
	| 'price_changed'
	| 'payment_pending'
	| 'completed'
	| 'expired'
	| 'failed';

export type Surface = 'web' | 'mobile';

export type ListingSnapshot = {
	id: string;
	eventName: string;
	venue: string;
	eventStart: string;
	section: string;
	row: string;
	quantity: number;
	reservedPrice: number;
};

export type Listing = {
	id: string;
	eventName: string;
	venue: string;
	eventStart: string;
	section: string;
	row: string;
	quantity: number;
	currentPrice: number;
	available: boolean;
};

export type Session = {
	id: string;
	listingId: string;
	listing: ListingSnapshot;
	reservedPrice: number;
	currentPrice: number;
	state: SessionState;
	surface: Surface;
	createdAt: string;
	expiresAt: string;
	version: number;
	completionToken: string | null;
	lastError: string | null;
};

export type CreateSessionRequest = {
	listingId: string;
	surface: Surface;
};

export type AcceptPriceRequest = Record<string, never>;

export type CompleteRequest = {
	completionToken: string;
};

export type TestSetPriceRequest = {
	price: number;
};

export type ApiError = {
	error: string;
	reason?: 'price_changed' | 'already_completed' | 'version_mismatch';
	current?: Session;
	sessionId?: string;
	listingId?: string;
	[key: string]: unknown;
};

export type AnalyticsEvent =
	| { event: 'session_created'; props: { sessionId: string; listingId: string; price: number; surface: Surface } }
	| { event: 'session_resumed'; props: { sessionId: string; surface: Surface; timeSinceCreated: number; state: SessionState } }
	| { event: 'price_change_shown'; props: { sessionId: string; oldPrice: number; newPrice: number } }
	| { event: 'price_change_accepted'; props: { sessionId: string } }
	| { event: 'completion_attempted'; props: { sessionId: string; attempt: number; idempotencyKey: string } }
	| { event: 'completion_succeeded'; props: { sessionId: string } }
	| { event: 'completion_conflict'; props: { sessionId: string; reason: string } }
	| { event: 'session_expired'; props: { sessionId: string; surface: Surface } }
	| { event: 'poll_degraded'; props: { sessionId: string; consecutiveFailures: number } };
