// Mock implementations of Google Apps Script Calendar services
const mockCalendarApp = () => ({
  GuestStatus: {
    YES: 'YES',
    NO: 'NO',
    MAYBE: 'MAYBE',
    INVITED: 'INVITED',
    DECLINED: 'DECLINED'
  },
  EventColor: {
    YELLOW: '5'
  },
  Visibility: {
    PRIVATE: 'PRIVATE',
    PUBLIC: 'PUBLIC',
    DEFAULT: 'DEFAULT'
  },
  getCalendarById: (id) => mockCalendar(id)
});

const mockCalendar = (id) => ({
  getId: () => id,
  getEvents: (start, end) => [],
  createEvent: (title, start, end) => mockEvent({
    title,
    startTime: start,
    endTime: end,
    id: 'new_event_' + Date.now()
  })
});

const mockEvent = (props = {}) => ({
  getId: () => props.id || 'mock_event_id',
  getTitle: () => props.title || 'Mock Event',
  getStartTime: () => props.startTime || new Date(),
  getEndTime: () => props.endTime || new Date(),
  getDescription: () => props.description || '',
  getCreators: () => props.creators || [PERSONAL_CALENDAR_ID],
  getMyStatus: () => props.myStatus || 'YES',
  isAllDayEvent: () => props.isAllDay || false,
  isRecurringEvent: () => props.isRecurring || false,
  getEventSeries: () => props.eventSeries || { getId: () => 'series_' + props.id },
  getGuestList: () => props.guestList || [],
  getStatus: () => props.status || 'CONFIRMED',
  setTitle: (title) => { props.title = title; },
  setTime: (start, end) => { 
    props.startTime = start;
    props.endTime = end;
  },
  setDescription: (desc) => { props.description = desc; },
  setColor: (color) => { props.color = color; },
  setVisibility: (vis) => { props.visibility = vis; },
  deleteEvent: () => {},
  ...props
});

module.exports = {
  mockCalendarApp,
  mockCalendar,
  mockEvent
};