package com.jira.util;

import com.jira.enums.DeadlineStatus;
import com.jira.enums.Status;

import java.time.LocalDate;

public class DeadlineCalculator {

    private DeadlineCalculator() {}

    // Keep enum overload for backward compat
    public static DeadlineStatus calculate(LocalDate dueDate, Status status) {
        return calculate(dueDate, status != null ? status.name() : null, LocalDate.now());
    }
    public static DeadlineStatus calculate(LocalDate dueDate, Status status, LocalDate currentDate) {
        return calculate(dueDate, status != null ? status.name() : null, currentDate);
    }

    /**
     * Core business rule - fully dynamic, generic workflow.
     * Rules:
     *  if status == DONE (or last workflow stage) -> COMPLETED
     *  else if currentDate < dueDate -> UPCOMING
     *  else if currentDate == dueDate -> DUE_TODAY
     *  else -> OVERDUE
     */
    public static DeadlineStatus calculate(LocalDate dueDate, String status) {
        return calculate(dueDate, status, LocalDate.now());
    }

    // Overload for testing with fixed current date
    public static DeadlineStatus calculate(LocalDate dueDate, String status, LocalDate currentDate) {
        if (status != null && "DONE".equalsIgnoreCase(status)) {
            return DeadlineStatus.COMPLETED;
        }
        // Generic: treat last workflow stage as DONE is handled at service level with project workflow
        // For now, also treat APPROVED/PUBLISHED as completed for custom workflows
        if (status != null && ("APPROVED".equalsIgnoreCase(status) || "PUBLISHED".equalsIgnoreCase(status) || "COMPLETED".equalsIgnoreCase(status))) {
            return DeadlineStatus.COMPLETED;
        }
        if (dueDate == null) {
            return DeadlineStatus.UPCOMING; // fallback if no due date (should not happen)
        }
        if (currentDate.isBefore(dueDate)) {
            return DeadlineStatus.UPCOMING;
        } else if (currentDate.isEqual(dueDate)) {
            return DeadlineStatus.DUE_TODAY;
        } else {
            return DeadlineStatus.OVERDUE;
        }
    }

    /**
     * For DONE issues: determine if completed on time or late
     * If completedDate <= dueDate -> on time, else late
     */
    public static boolean isCompletedOnTime(LocalDate dueDate, LocalDate completedDate) {
        if (dueDate == null || completedDate == null) return true;
        return !completedDate.isAfter(dueDate);
    }

    public static String completionLabel(LocalDate dueDate, LocalDate completedDate) {
        if (dueDate == null || completedDate == null) return "Completed";
        return isCompletedOnTime(dueDate, completedDate) ? "Completed on time" : "Completed late";
    }
}
