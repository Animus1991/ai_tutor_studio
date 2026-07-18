/**
 * Real Google Calendar fetch (readonly) with demo fallback.
 * Demo mocks are always labeled and never used for ACL decisions.
 */
import type { CalendarEvent } from './DemoCalendarService';
import { calendarService as demoCalendar } from './DemoCalendarService';

export type CalendarFetchResult = {
  events: CalendarEvent[];
  source: 'google' | 'demo';
  error?: string;
};

function mapGoogleEvent(raw: {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}): CalendarEvent | null {
  const startIso = raw.start?.dateTime || raw.start?.date;
  if (!startIso) return null;
  const endIso = raw.end?.dateTime || raw.end?.date;
  return {
    summary: raw.summary?.trim() || 'Untitled event',
    start: { dateTime: startIso },
    end: endIso ? { dateTime: endIso } : undefined,
  };
}

/** Fetch upcoming events with a scoped OAuth access token. */
export async function fetchUpcomingCalendarEvents(
  accessToken: string | null | undefined,
  opts: { maxResults?: number; preferDemo?: boolean } = {},
): Promise<CalendarFetchResult> {
  if (opts.preferDemo || !accessToken) {
    const events = await demoCalendar.getUpcomingEvents();
    return { events, source: 'demo' };
  }

  try {
    const max = Math.min(Math.max(opts.maxResults ?? 10, 1), 40);
    const timeMin = new Date().toISOString();
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('maxResults', String(max));
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('timeMin', timeMin);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const events = await demoCalendar.getUpcomingEvents();
      return {
        events,
        source: 'demo',
        error: `Calendar API ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      items?: Array<{
        summary?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
    };
    const events = (data.items ?? [])
      .map(mapGoogleEvent)
      .filter((e): e is CalendarEvent => Boolean(e));
    return { events, source: 'google' };
  } catch (err) {
    const events = await demoCalendar.getUpcomingEvents();
    return {
      events,
      source: 'demo',
      error: err instanceof Error ? err.message : 'Calendar fetch failed',
    };
  }
}
