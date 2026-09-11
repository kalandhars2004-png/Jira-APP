package com.jira.enums;

/**
 * Dynamically calculated deadline state.
 * DO NOT persist as primary status - calculate from current date + dueDate + status.
 */
public enum DeadlineStatus {
    UPCOMING,   // current date < dueDate and not DONE
    DUE_TODAY,  // current date == dueDate and not DONE
    OVERDUE,    // current date > dueDate and not DONE
    COMPLETED   // status == DONE
}
