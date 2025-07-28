// Test configuration with safe dummy values
// This file is safe to commit and used only for testing
const CONFIG = {
  // Calendar IDs - using test/dummy values
  PERSONAL_CALENDAR_ID: "test.personal@example.com",
  WORK_CALENDAR_ID: "test.work@example.com",
  
  // Additional email addresses for testing
  ADDITIONAL_EMAILS: [
    "test.additional1@example.com",
    "test.additional2@example.com"
  ],

  // Event Settings
  SCRIPT_EVENT_TITLE: "[SYNCED PERSONAL EVENT]",
  LOOKAHEAD_DAYS: 7,
  
  // Filtering Options
  IGNORE_ALL_DAY_EVENTS: true,
  IGNORE_STATUS_FOR_OWN_EVENTS: true,
  EXCLUDE_WEEKENDS: true,
  
  // Debug Options
  DRY_RUN: false,
  VERBOSE_LOGGING: true
};

// Export the config
module = module || {};
module.exports = CONFIG; 
