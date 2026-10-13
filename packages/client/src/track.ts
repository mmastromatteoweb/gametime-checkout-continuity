import type { AnalyticsEvent } from '@checkout/types';

export type Tracker = (event: AnalyticsEvent['event'], props: Record<string, unknown>) => void;

export const noopTracker: Tracker = () => {};
