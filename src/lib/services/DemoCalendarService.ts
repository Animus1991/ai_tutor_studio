export interface CalendarEvent {
  summary: string;
  start: { dateTime: string };
  end?: { dateTime: string };
}

export class DemoCalendarService {
  private static instance: DemoCalendarService;

  private constructor() {}

  public static getInstance(): DemoCalendarService {
    if (!DemoCalendarService.instance) {
      DemoCalendarService.instance = new DemoCalendarService();
    }
    return DemoCalendarService.instance;
  }

  public async getUpcomingEvents(): Promise<CalendarEvent[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const now = Date.now();
    return [
      {
        summary: "Team Meeting",
        start: { dateTime: new Date(now + 3600000).toISOString() } // 1 hour from now
      },
      {
        summary: "Project Deadline",
        start: { dateTime: new Date(now + 86400000).toISOString() } // 1 day from now
      },
      {
        summary: "Study Session",
        start: { dateTime: new Date(now + 172800000).toISOString() } // 2 days from now
      }
    ];
  }
}

export const calendarService = DemoCalendarService.getInstance();
