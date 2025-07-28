const { mockCalendarApp, mockEvent } = require('./testUtils');

// Mock the global Apps Script environment
global.CalendarApp = mockCalendarApp();
global.console = {
  log: jest.fn(),
  error: jest.fn()
};

// Import constants from Code.js
const PERSONAL_CALENDAR_ID = "the.carrancas@gmail.com";
const WORK_CALENDAR_ID = "mcarranca@squareup.com";
const SCRIPT_PREFIX = "[SYNCED PERSONAL EVENT]";
const myEmails = [
  PERSONAL_CALENDAR_ID,
  WORK_CALENDAR_ID,
  "mariokarras@gmail.com",
  "mario.carranca@gmail.com"
];

// Import functions from Code.js by reading the file
const fs = require('fs');
const vm = require('vm');
const CONFIG = require('./config.js');

const codeContent = fs.readFileSync('./Code.js', 'utf8');
const context = {
  PERSONAL_CALENDAR_ID,
  WORK_CALENDAR_ID,
  SCRIPT_PREFIX,
  myEmails,
  CalendarApp: global.CalendarApp,
  console: global.console,
  Map: Map, // Needed for workEventsMap
  // Provide require function for CONFIG
  require: (path) => {
    if (path === './config.js') {
      return CONFIG;
    }
    throw new Error(`Module not found: ${path}`);
  },
  module: {}, // Provide module object
  CONFIG: CONFIG
};
vm.createContext(context);
vm.runInContext(codeContent, context);

describe('Calendar Sync', () => {
  describe('Event Creation and Matching', () => {
    test('creates work event data with consistent identifier placement', () => {
      const personalEvent = mockEvent({
        id: 'test123',
        title: 'Team Meeting',
        startTime: new Date('2023-10-20T10:00:00'),
        endTime: new Date('2023-10-20T11:00:00')
      });

      const result = context.createOrUpdateWorkEventData(personalEvent);
      
      // Check that identifier is at the start of description
      expect(result.description.startsWith(SCRIPT_PREFIX)).toBe(true);
      
      // Verify the identifier part is properly separated from details
      const [identifierPart, detailsPart] = result.description.split('\n\n');
      expect(identifierPart).toContain('test123');
      expect(detailsPart).toContain('Team Meeting');
    });

    test('workEventsMap correctly matches events using identifier', () => {
      const workCalendar = mockCalendarApp().getCalendarById(WORK_CALENDAR_ID);
      
      // Create two events with same identifier but different details
      const event1 = mockEvent({
        description: SCRIPT_PREFIX + 'event123_20231020\n\nOriginal Title: Meeting\nStart: old time',
        title: '[SYNC]'
      });
      
      const event2 = mockEvent({
        description: SCRIPT_PREFIX + 'event123_20231020\n\nOriginal Title: Meeting Updated\nStart: new time',
        title: '[SYNC]'
      });

      // Mock getEvents to return our test events
      workCalendar.getEvents = () => [event1, event2];

      const eventsMap = context.getWorkEventsMap(workCalendar);
      
      // Should map both events to the same key (only keeping one)
      expect(eventsMap.size).toBe(1);
      expect(eventsMap.get(SCRIPT_PREFIX + 'event123_20231020')).toBeDefined();
    });
  });

  describe('shouldCreateOrUpdate', () => {
    test('returns false for weekend events when EXCLUDE_WEEKENDS is true', () => {
      const saturdayEvent = mockEvent({
        startTime: new Date('2023-10-21T10:00:00'), // A Saturday
        title: 'Weekend Event'
      });
      
      expect(context.shouldCreateOrUpdate(saturdayEvent)).toBe(false);
    });

    test('returns false for all-day events when IGNORE_ALL_DAY_EVENTS is true', () => {
      const allDayEvent = mockEvent({
        startTime: new Date('2023-10-20T00:00:00'),
        endTime: new Date('2023-10-21T00:00:00'),
        isAllDay: true
      });
      
      expect(context.shouldCreateOrUpdate(allDayEvent)).toBe(false);
    });
  });

  describe('isEventDifferent', () => {
    test('detects changes in event details while ignoring description formatting', () => {
      const baseEvent = mockEvent({
        title: '[SYNC]',
        startTime: new Date('2023-10-20T10:00:00'),
        endTime: new Date('2023-10-20T11:00:00'),
        description: SCRIPT_PREFIX + 'event123\n\nOriginal Title: Meeting'
      });

      const sameEventData = {
        title: '[SYNC]',
        startTime: new Date('2023-10-20T10:00:00'),
        endTime: new Date('2023-10-20T11:00:00'),
        description: SCRIPT_PREFIX + 'event123\n\nOriginal Title: Meeting'
      };

      const differentEventData = {
        title: '[SYNC]',
        startTime: new Date('2023-10-20T10:30:00'), // Different time
        endTime: new Date('2023-10-20T11:30:00'),
        description: SCRIPT_PREFIX + 'event123\n\nOriginal Title: Meeting'
      };

      expect(context.isEventDifferent(baseEvent, sameEventData)).toBe(false);
      expect(context.isEventDifferent(baseEvent, differentEventData)).toBe(true);
    });
  });
});
