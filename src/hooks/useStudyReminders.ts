import { useEffect, useRef } from 'react';
import { calendarService } from '../lib/services/DemoCalendarService';
import { toast } from 'sonner';

export function useStudyReminders() {
  const checkInterval = useRef<NodeJS.Timeout | null>(null);
  const notifiedEvents = useRef<Set<string>>(new Set());

  useEffect(() => {
    const checkUpcomingEvents = async () => {
      try {
        const events = await calendarService.getUpcomingEvents();
        const now = Date.now();
        
        events.forEach(event => {
          const startTime = new Date(event.start.dateTime).getTime();
          const timeUntilEvent = startTime - now;
          const fifteenMinutes = 15 * 60 * 1000;
          
          // If event is starting in less than 15 minutes and hasn't been notified yet
          if (timeUntilEvent > 0 && timeUntilEvent <= fifteenMinutes && !notifiedEvents.current.has(event.summary)) {
            toast.info(`Reminder: "${event.summary}" is starting soon!`, {
              description: `Starts in ${Math.round(timeUntilEvent / 60000)} minutes`,
              duration: 8000,
            });
            notifiedEvents.current.add(event.summary);
          }
        });
      } catch (err) {
        console.error('Failed to fetch events for reminders:', err);
      }
    };

    // Initial check
    checkUpcomingEvents();
    
    // Check every 5 minutes
    checkInterval.current = setInterval(checkUpcomingEvents, 5 * 60 * 1000);

    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
    };
  }, []);
}
