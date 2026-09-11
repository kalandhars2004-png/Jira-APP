package com.jira.util;

import com.jira.enums.DeadlineStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class DeadlineCalculator {

    private DeadlineCalculator() {}

    // Legacy LocalDate overloads — preserved so callers using date-only still compile.
    // A date-only dueDate is treated as midnight (end of start-of-day boundary is excluded).
    public static DeadlineStatus calculate(LocalDate dueDate, String status) {
        return calculate(dueDate != null ? dueDate.atStartOfDay() : null, status, LocalDateTime.now());
    }
    public static DeadlineStatus calculate(LocalDate dueDate, String status, LocalDate currentDate) {
        return calculate(dueDate != null ? dueDate.atStartOfDay() : null, status,
                currentDate != null ? currentDate.atStartOfDay() : LocalDateTime.now());
    }

    /**
     * Core business rule — fully dynamic, generic workflow, MINUTE-LEVEL precision.
     * Rules:
     *  if status is a final/completed stage            -> COMPLETED
     *  else if dueDateTime == null                      -> UPCOMING
     *  else if now < dueDateTime                        -> DUE_TODAY if due is today, else UPCOMING
     *  else (now >= dueDateTime)                        -> OVERDUE  (compare year..second)
     */
    public static DeadlineStatus calculate(LocalDateTime dueDateTime, String status) {
        return calculate(dueDateTime, status, LocalDateTime.now());
    }

    // Overload for testing with fixed current datetime
    public static DeadlineStatus calculate(LocalDateTime dueDateTime, String status, LocalDateTime now) {
        if (status != null && isCompletedStatus(status)) {
            return DeadlineStatus.COMPLETED;
        }
        if (dueDateTime == null) {
            return DeadlineStatus.UPCOMING; // no due date -> never overdue
        }
        if (now.isBefore(dueDateTime)) {
            LocalDate nowDate = now.toLocalDate();
            return dueDateTime.toLocalDate().isEqual(nowDate) ? DeadlineStatus.DUE_TODAY : DeadlineStatus.UPCOMING;
        }
        return DeadlineStatus.OVERDUE;
    }

    public static boolean isCompletedStatus(String status) {
        if (status == null) return false;
        return "DONE".equalsIgnoreCase(status)
                || "APPROVED".equalsIgnoreCase(status)
                || "PUBLISHED".equalsIgnoreCase(status)
                || "COMPLETED".equalsIgnoreCase(status);
    }

    /**
     * For completed (final-stage) issues: determine if completed on time or late.
     * Completed on time if completedDate <= dueDate day (the due time on that day).
     */
    public static boolean isCompletedOnTime(LocalDateTime dueDate, LocalDate completedDate) {
        if (dueDate == null || completedDate == null) return true;
        return !completedDate.isAfter(dueDate.toLocalDate());
    }

    public static String completionLabel(LocalDateTime dueDate, LocalDate completedDate) {
        if (dueDate == null || completedDate == null) return "Completed";
        return isCompletedOnTime(dueDate, completedDate) ? "Completed on time" : "Completed late";
    }
}