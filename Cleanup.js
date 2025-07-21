// Cleanup script for removing all synced events
// Uses constants defined in Code.js

function cleanupSyncedEvents() {
  // Configuration
  const DRY_RUN = true; // Set to false to actually delete events
  const BATCH_SIZE = 10; // Process events in smaller batches
  const BATCH_DELAY = 1000; // 1 second delay between batches
  
  console.log('Starting cleanup at:', new Date().toISOString());
  console.log('DRY_RUN:', DRY_RUN);
  
  const workCalendar = CalendarApp.getCalendarById(WORK_CALENDAR_ID);
  
  // Look back 6 month and forward 6 month to catch all synced events
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const sixMonthsAhead = new Date();
  sixMonthsAhead.setMonth(sixMonthsAhead.getMonth() + 6);
  
  console.log('Fetching events from', sixMonthsAgo, 'to', sixMonthsAhead);
  
  const events = workCalendar.getEvents(sixMonthsAgo, sixMonthsAhead);
  const syncedEvents = events.filter(event => {
    try {
      // Check for events from either the old or new format
      const title = event.getTitle();
      const description = event.getDescription() || '';

      // Old format: Title starts with "[SYNCED] "
      const isOldFormat = title.startsWith("[SYNCED]");
      
      // New format: Title is exactly "[SYNC]"
      const isNewFormat = title === SCRIPT_EVENT_TITLE;
      
      // Check description for any format
      const hasScriptPrefix = description.includes("[SYNCED]") || description.includes(SCRIPT_EVENT_TITLE);

      const willDelete = isOldFormat || isNewFormat || hasScriptPrefix
      if (DRY_RUN) {
        console.log('Analyzed event ', title, ' idOldFormat=', isOldFormat, ', isNewFormat=', isNewFormat, ', hasScriptPrefix=', hasScriptPrefix, ' will delete: ', willDelete);
      }
      return willDelete;
    } catch (error) {
      console.error('Error checking event:', error);
      return false;
    }
  });
  
  console.log('Found', syncedEvents.length, 'synced events to delete');
  
  // Process events in batches
  for (let i = 0; i < syncedEvents.length; i += BATCH_SIZE) {
    const batch = syncedEvents.slice(i, i + BATCH_SIZE);
    console.log('Processing batch', Math.floor(i / BATCH_SIZE) + 1, 
                'of', Math.ceil(syncedEvents.length / BATCH_SIZE));
    
    batch.forEach(event => {
      try {
        console.log('Deleting event:', event.getTitle(), 'on', event.getStartTime());
        if (!DRY_RUN) {
          event.deleteEvent();
        }
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    });
    
    // Add delay between batches to avoid quota issues
    if (i + BATCH_SIZE < syncedEvents.length && !DRY_RUN) {
      Utilities.sleep(BATCH_DELAY);
    }
  }
  
  console.log('Cleanup completed at:', new Date().toISOString());
  if (DRY_RUN) {
    console.log('This was a dry run. Set DRY_RUN = false to actually delete events.');
  }
}