# Calendar Sync

A Google Apps Script to sync events between your personal and work calendars while keeping your personal calendar private.

## Features

- Syncs accepted events from your personal calendar to your work calendar
- Marks work events as "private" to hide details
- Handles recurring events
- Supports multiple email addresses
- Configurable filters for all-day events and weekends
- Rate limiting with exponential backoff
- Dry-run mode for testing

## How It Works

1. The script reads events from your personal calendar for the configured time period
2. For each event:
   - Checks if you've accepted the event
   - Applies configured filters (all-day, weekends, etc.)
   - Creates a corresponding private event in your work calendar
3. Events are synced one-way (personal → work)
4. Work calendar events are marked private and include a reference to track updates


## Project Structure

- `Code.js` - Main script file
- `Code.test.js` - Test suite
- `testUtils.js` - Test utilities and mocks
- `.clasp.json` - Clasp configuration
- `appsscript.json` - Apps Script manifest

## Setup

1. Copy `config.template.js` to `config.js`:
```bash
cp config.template.js config.js
```

2. Edit `config.js` and update the following settings:
   - `PERSONAL_CALENDAR_ID`: Your personal Gmail calendar ID
   - `WORK_CALENDAR_ID`: Your work calendar ID
   - `ADDITIONAL_EMAILS`: Any other email addresses you use to create calendar events

3. Optional settings you can customize:
   - `SCRIPT_EVENT_TITLE`: The prefix for synced events (default: "[SYNCED PERSONAL EVENT]")
   - `LOOKAHEAD_DAYS`: How many days to sync (default: 7)
   - `IGNORE_ALL_DAY_EVENTS`: Whether to skip all-day events (default: true)
   - `IGNORE_STATUS_FOR_OWN_EVENTS`: Whether to ignore RSVP status for events you created (default: true)
   - `EXCLUDE_WEEKENDS`: Whether to skip weekend events (default: true)
   - `DRY_RUN`: Test mode - no actual changes will be made (default: false)
   - `VERBOSE_LOGGING`: Enable detailed logging (default: true)

## Deployment

1. Install dependencies:
```bash
npm install
```

2. Configure clasp including logging into your Google Apps account:
```bash
clasp login
```

3. Push changes to Google Apps Script:
```bash
npm run deploy
```

## Trigger Setup

The script is triggered by the "Calendar - Changed" event for the personal calendar. This means it runs automatically whenever changes occur in the personal calendar.

## Testing

The project includes a comprehensive test suite using Jest:

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Security

The `config.js` file is ignored by git to prevent accidentally committing your personal calendar IDs. Make sure to keep your config secure and never commit it to version control.

## Error Handling

The script includes several error handling features:

1. Rate Limiting
   - Implements exponential backoff for API calls
   - Adds delays between operations
   - Batches updates and deletions

2. Error Recovery
   - Retries failed operations up to 3 times
   - Logs errors for debugging
   - Continues processing after individual event failures

3. Validation
   - Checks event status before processing
   - Validates event properties
   - Handles missing or invalid data

## Logging

When `VERBOSE_LOGGING` is enabled, the script logs:
- Start and end of sync operations
- Configuration settings
- Event processing details
- API operation results
- Error messages and stack traces

## Known Limitations

1. Google Calendar API Quotas
   - The script implements rate limiting to handle quota restrictions
   - Default lookahead period reduced to ~1 week to minimize API calls

2. Recurring Events
   - Each instance is handled individually
   - Series modifications may require manual cleanup

## Troubleshooting

1. Duplicate Events
   - Enable `DRY_RUN` and `VERBOSE_LOGGING`
   - Check logs for event identifier generation
   - Verify work calendar event map creation

2. Rate Limiting
   - Reduce `LOOKAHEAD_PERIOD_MONTHS`
   - Check Apps Script quotas in Google Cloud Console
   - Review error logs for specific quota issues

3. Missing Events
   - Verify event filtering in `shouldCreateOrUpdate`
   - Check RSVP status handling
   - Review personal calendar permissions
