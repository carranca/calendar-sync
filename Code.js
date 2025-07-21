// Import configuration
const CONFIG = require('./config.js');

// Combine additional emails with calendar IDs for complete email list
const myEmails = [
  CONFIG.PERSONAL_CALENDAR_ID,
  CONFIG.WORK_CALENDAR_ID,
  ...CONFIG.ADDITIONAL_EMAILS
];

/////////////////////////////////////////////
// Helper: verboseLog
/////////////////////////////////////////////
function verboseLog(...args) {
  if (CONFIG.VERBOSE_LOGGING) {
    console.log(...args);
  }
}

/////////////////////////////////////////////
// Helper: isTrulyAllDay
/////////////////////////////////////////////
function isTrulyAllDay(event) {
  if (event.isAllDayEvent()) {
    return true;
  }

  const start = event.getStartTime();
  const end = event.getEndTime();

  // Check if both times are midnight and the difference is exactly 24 hours
  const startsAtMidnight = start.getHours() === 0 && start.getMinutes() === 0;
  const endsAtMidnight = end.getHours() === 0 && end.getMinutes() === 0;

  const diffMs = end.getTime() - start.getTime();
  const oneDayMs = 86400000; // 24 hours

  return startsAtMidnight && endsAtMidnight && diffMs === oneDayMs;
}

/////////////////////////////////////////////
// Helper: isWeekend
/////////////////////////////////////////////
function isWeekend(event) {
  // Check the start day (0 = Sunday, 6 = Saturday)
  const startDay = event.getStartTime().getDay();
  return startDay === 0 || startDay === 6;
}

/////////////////////////////////////////////
// Main Sync Entry Point
/////////////////////////////////////////////
function onPersonalCalendarUpdate() {
  // Optional: use LockService so only one run can happen at a time
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    console.log("Could not obtain lock, another instance is running.");
    return;
  }
  try {
    verboseLog("Starting sync at:", new Date().toISOString());
    verboseLog("Configuration:", {
      LOOKAHEAD_DAYS: CONFIG.LOOKAHEAD_DAYS,
      DRY_RUN: CONFIG.DRY_RUN,
      IGNORE_ALL_DAY_EVENTS: CONFIG.IGNORE_ALL_DAY_EVENTS,
      IGNORE_STATUS_FOR_OWN_EVENTS: CONFIG.IGNORE_STATUS_FOR_OWN_EVENTS,
      EXCLUDE_WEEKENDS: CONFIG.EXCLUDE_WEEKENDS
    });

    const calendar = CalendarApp.getCalendarById(CONFIG.PERSONAL_CALENDAR_ID);
    const now = new Date();

    // We'll look ahead LOOKAHEAD_DAYS from now
    const period = new Date(now);
    period.setDate(now.getDate() + CONFIG.LOOKAHEAD_DAYS);

    // Fetch events from the personal calendar
    const personalEvents = calendar.getEvents(now, period);
    verboseLog("Found", personalEvents.length, "personal events to process");

    const workCalendar = CalendarApp.getCalendarById(CONFIG.WORK_CALENDAR_ID);
    const workEventsMap = getWorkEventsMap(workCalendar);
    verboseLog("Found", workEventsMap.size, "existing work calendar events");

    // We'll gather creations, updates, deletes
    const eventsToCreate = [];
    const eventsToUpdate = [];
    const eventsToDelete = [];

    // Track which personal event IDs we processed
    const processedEventIds = new Set();

    personalEvents.forEach(event => {
      try {
        const eventIdentifier = getEventIdentifier(event);
        const identifierString = CONFIG.SCRIPT_EVENT_TITLE + eventIdentifier;
        processedEventIds.add(identifierString);
        
        const existingWorkEvent = workEventsMap.get(identifierString);
        const shouldSync = shouldCreateOrUpdate(event);

        if (shouldSync && !existingWorkEvent) {
          // We'll create a new event
          const workEventData = createOrUpdateWorkEventData(event);
          eventsToCreate.push(workEventData);
        } else if (shouldSync && existingWorkEvent) {
          // Potentially update if different
          const workEventData = createOrUpdateWorkEventData(event);
          if (isEventDifferent(existingWorkEvent, workEventData)) {
            eventsToUpdate.push({ existingWorkEvent, workEventData });
          }
        } else {
          // Not supposed to exist in work calendar
          if (existingWorkEvent) {
            eventsToDelete.push(existingWorkEvent);
          }
        }
      } catch (error) {
        console.error("Error processing event:", event.getTitle(), error);
      }
    });

    // Clean up orphaned work events (those created by script but not found in personal)
    workEventsMap.forEach((workEvent, eventIdentifier) => {
      if (!processedEventIds.has(eventIdentifier)) {
        // This is an orphan
        eventsToDelete.push(workEvent);
      }
    });

    // Now process them in phases if not DRY_RUN
    if (!CONFIG.DRY_RUN) {
      verboseLog("Creating", eventsToCreate.length, "events...");
      processEventCreations(workCalendar, eventsToCreate);

      verboseLog("Updating", eventsToUpdate.length, "events...");
      processEventUpdates(eventsToUpdate);

      verboseLog("Deleting", eventsToDelete.length, "events...");
      processEventDeletions(eventsToDelete);
    } else {
      verboseLog("DRY RUN - Would create:", eventsToCreate.length, "events");
      verboseLog("DRY RUN - Would update:", eventsToUpdate.length, "events");
      verboseLog("DRY RUN - Would delete:", eventsToDelete.length, "events");
    }

    verboseLog("Sync completed at:", new Date().toISOString());
  } catch (e) {
    console.error("Error in onPersonalCalendarUpdate:", e);
  } finally {
    lock.releaseLock();
  }
}

/////////////////////////////////////////////
// Helper: getEventIdentifier
/////////////////////////////////////////////
function getEventIdentifier(event) {
  if (event.isRecurringEvent()) {
    const series = event.getEventSeries();
    return series.getId();
  }
  return event.getId() + "_" + event.getStartTime().toISOString();
}

/////////////////////////////////////////////
// Helper: shouldCreateOrUpdate
/////////////////////////////////////////////
function shouldCreateOrUpdate(event) {
  try {
    // Check if all-day and skip
    if (CONFIG.IGNORE_ALL_DAY_EVENTS && isTrulyAllDay(event)) {
      verboseLog("Ignoring all-day event:", event.getTitle());
      return false;
    }

    // Check if weekend and skip
    if (CONFIG.EXCLUDE_WEEKENDS && isWeekend(event)) {
      verboseLog("Ignoring weekend event:", event.getTitle());
      return false;
    }

    const myStatus = event.getMyStatus();
    const creatorEmail = event.getCreators()[0];

    // If event is created by a recognized email
    if (myEmails.includes(creatorEmail)) {
      if (CONFIG.IGNORE_STATUS_FOR_OWN_EVENTS) {
        return true;
      }
      // If we don't ignore status, only sync if not declined
      return (
        myStatus !== CalendarApp.GuestStatus.NO &&
        myStatus !== CalendarApp.GuestStatus.DECLINED
      );
    }

    // For events not created by me, check if I'm an invited guest who accepted
    const guestList = event.getGuestList(true);
    const guest = guestList.find(g => myEmails.includes(g.getEmail()));

    if (guest) {
      return (
        guest.getGuestStatus() === CalendarApp.GuestStatus.YES ||
        guest.getGuestStatus() === CalendarApp.GuestStatus.MAYBE
      );
    }

    return false;
  } catch (error) {
    console.error("Error in shouldCreateOrUpdate:", error);
    return false;
  }
}

/////////////////////////////////////////////
// Helper: createOrUpdateWorkEventData
/////////////////////////////////////////////
function createOrUpdateWorkEventData(event) {
  const eventIdentifier = getEventIdentifier(event);
  const identifierString = CONFIG.SCRIPT_EVENT_TITLE + eventIdentifier;

  return {
    title: CONFIG.SCRIPT_EVENT_TITLE,
    startTime: event.getStartTime(),
    endTime: event.getEndTime(),
    // Put the identifier FIRST, then the readable info
    description: identifierString + "\n\n" +
                "Original Title: " + event.getTitle() + 
                "\nStart: " + event.getStartTime() + 
                "\nEnd: " + event.getEndTime(),
    color: CalendarApp.EventColor.GRAY,
    visibility: CalendarApp.Visibility.PRIVATE,
    isRecurring: event.isRecurringEvent()
  };
}

/////////////////////////////////////////////
// Helper: isEventDifferent
/////////////////////////////////////////////
function isEventDifferent(workEvent, workEventData) {
  return (
    workEvent.getTitle() !== workEventData.title ||
    workEvent.getStartTime().toISOString() !== workEventData.startTime.toISOString() ||
    workEvent.getEndTime().toISOString() !== workEventData.endTime.toISOString() ||
    workEvent.getDescription() !== workEventData.description
  );
}

/////////////////////////////////////////////
// processEventCreations (Batch creation w/ backoff)
/////////////////////////////////////////////
function processEventCreations(workCalendar, eventsToCreate) {
  for (let i = 0; i < eventsToCreate.length; i++) {
    try {
      createWorkEventWithBackoff(workCalendar, eventsToCreate[i]);

      // Sleep ~100ms between events to reduce burst
      if (i < eventsToCreate.length - 1) {
        Utilities.sleep(100);
      }
    } catch (error) {
      console.error("Failed to create event:", eventsToCreate[i].title, error.message);
    }
  }
}

// Our event creation with exponential backoff.
function createWorkEventWithBackoff(workCalendar, workEventData) {
  if (CONFIG.DRY_RUN) {
    verboseLog("[DRY RUN] Would create event:", workEventData);
    return;
  }

  let retries = 3;
  let attemptSuccess = false;
  let delayMs = 500; // Start backoff delay

  while (retries > 0 && !attemptSuccess) {
    try {
      verboseLog(
        `[Attempt] Creating event: ${workEventData.title}, retries left: ${retries}`
      );
      const newWorkEvent = workCalendar.createEvent(
        workEventData.title,
        workEventData.startTime,
        workEventData.endTime
      );
      newWorkEvent.setColor(workEventData.color);
      newWorkEvent.setDescription(workEventData.description);
      newWorkEvent.setVisibility(workEventData.visibility);
      newWorkEvent.removeAllReminders();

      attemptSuccess = true;
    } catch (error) {
      if (error.message.includes("too many calendars or calendar events")) {
        retries--;
        if (retries > 0) {
          verboseLog(`Rate-limited: sleeping for ${delayMs} ms before retry...`);
          Utilities.sleep(delayMs);
          delayMs *= 2; // Exponential backoff
        }
      } else {
        throw error;
      }
    }
  }

  if (!attemptSuccess) {
    throw new Error(
      `Exceeded max retries while creating event: ${workEventData.title}`
    );
  }
}

/////////////////////////////////////////////
// processEventUpdates (we already had backoff in place)
/////////////////////////////////////////////
function processEventUpdates(eventsToUpdate) {
  for (let i = 0; i < eventsToUpdate.length; i++) {
    try {
      const { existingWorkEvent, workEventData } = eventsToUpdate[i];

      let retries = 3;
      let delayMs = 500; // start backoff
      while (retries > 0) {
        try {
          existingWorkEvent.setTitle(workEventData.title);
          existingWorkEvent.setTime(
            workEventData.startTime,
            workEventData.endTime
          );
          existingWorkEvent.setDescription(workEventData.description);
          existingWorkEvent.setColor(workEventData.color);
          existingWorkEvent.setVisibility(workEventData.visibility);
          break;
        } catch (e) {
          if (e.message.includes("too many calendars or calendar events")) {
            retries--;
            if (retries > 0) {
              verboseLog(
                `Rate-limited (update): sleeping for ${delayMs} ms...`
              );
              Utilities.sleep(delayMs);
              delayMs *= 2;
              continue;
            }
          }
          throw e;
        }
      }

      // Sleep a bit between updates to reduce bursts
      if (i < eventsToUpdate.length - 1) {
        Utilities.sleep(100);
      }
    } catch (error) {
      console.error("Failed to update event:", error.message);
    }
  }
}

/////////////////////////////////////////////
// processEventDeletions (we already had backoff in place)
/////////////////////////////////////////////
function processEventDeletions(eventsToDelete) {
  for (let i = 0; i < eventsToDelete.length; i++) {
    try {
      const workEvent = eventsToDelete[i];
      verboseLog("Deleting event:", workEvent.getTitle());

      if (CONFIG.DRY_RUN) {
        continue;
      }

      let retries = 3;
      let delayMs = 500;
      while (retries > 0) {
        try {
          workEvent.deleteEvent();
          break; // success
        } catch (e) {
          if (e.message.includes("too many calendars or calendar events")) {
            retries--;
            if (retries > 0) {
              verboseLog(
                `Rate-limited (delete): sleeping for ${delayMs} ms...`
              );
              Utilities.sleep(delayMs);
              delayMs *= 2;
              continue;
            }
          }
          throw e;
        }
      }

      // Sleep a bit between deletions
      if (i < eventsToDelete.length - 1) {
        Utilities.sleep(100);
      }
    } catch (error) {
      console.error("Failed to delete event:", error.message);
    }
  }
}

/////////////////////////////////////////////
// Helper: getWorkEventsMap
/////////////////////////////////////////////
function getWorkEventsMap(workCalendar) {
  const now = new Date();

  // We'll look 7 days back and forward
  const pastDate = new Date(now);
  pastDate.setDate(now.getDate() - CONFIG.LOOKAHEAD_DAYS);

  const futureDate = new Date(now);
  futureDate.setDate(now.getDate() + CONFIG.LOOKAHEAD_DAYS);

  verboseLog("Fetching work events from", pastDate, "to", futureDate);

  const workEvents = workCalendar.getEvents(pastDate, futureDate);
  const workEventsMap = new Map();

  workEvents.forEach(event => {
    try {
      const desc = event.getDescription();
      // Only look for events with our prefix
      if (desc && desc.startsWith(CONFIG.SCRIPT_EVENT_TITLE)) {
        // Extract just the identifier part (everything before the first \n\n)
        const identifierPart = desc.split('\n\n')[0];
        workEventsMap.set(identifierPart, event);
      }
    } catch (error) {
      console.error("Error processing work event:", error);
    }
  });

  return workEventsMap;
}
