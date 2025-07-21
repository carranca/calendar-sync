// Copy this file to config.js and update with your values
const CONFIG = {
  // Calendar IDs
  PERSONAL_CALENDAR_ID: "your.personal@gmail.com",
  WORK_CALENDAR_ID: "your.work@email.com",
  
  // Additional email addresses you use to create events
  ADDITIONAL_EMAILS: [
    "another.email@gmail.com",
    "yet.another@gmail.com"
  ],

  // Event Settings
  // Title for events created by the script
  SCRIPT_EVENT_TITLE: "[SYNCED PERSONAL EVENT]",

  // How many days to look ahead for events to sync
  LOOKAHEAD_DAYS: 7,
  
  // Filtering Options
  // Whether all day events should be ignored when syncing
  IGNORE_ALL_DAY_EVENTS: true,
  // Whether the status of events created by the script should be ignored when syncing
  IGNORE_STATUS_FOR_OWN_EVENTS: true,
  // Whether weekends should be excluded when syncing
  EXCLUDE_WEEKENDS: true,
  
  // Debug Options
  // Whether to run the script in dry run mode
  DRY_RUN: false,
  // Whether to log verbose information
  VERBOSE_LOGGING: true
};

// Export the config
module = module || {};
module.exports = CONFIG;
