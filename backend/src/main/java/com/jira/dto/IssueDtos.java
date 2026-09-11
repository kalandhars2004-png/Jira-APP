package com.jira.dto;

import com.jira.enums.DeadlineStatus;
import com.jira.enums.IssueType;
import com.jira.enums.Priority;
import com.jira.enums.Status;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class IssueDtos {

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateIssueRequest {
        @NotNull
        private Long projectId;
        @NotBlank
        private String title;
        private String description;
        private IssueType issueType;
        private Priority priority;
        private String status; // Generic — can be any workflow stage
        private Long assigneeId;
        private Long reporterId;
        @NotNull(message = "Due date and time is required")
        private LocalDateTime dueDate;
        // Generic fields — can be anything
        private String labels;
        private Integer storyPoints;
        private String sprint;
        private String components;
        private Long parentId; // for subtasks
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UpdateIssueRequest {
        private String title;
        private String description;
        private IssueType issueType;
        private Priority priority;
        private String status;
        private Long assigneeId;
        private LocalDateTime dueDate;
        private String labels;
        private Integer storyPoints;
        private String sprint;
        private String components;
        private Long parentId;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class IssueResponse {
        private Long id;
        private Long projectId;
        private String issueKey;
        private String title;
        private String description;
        private IssueType issueType;
        private Priority priority;
        private String status;
        private Long assigneeId;
        private String assigneeName;
        private Long reporterId;
        private String reporterName;
        private String projectKey;
        private String projectName;
        private LocalDateTime dueDate;
        private LocalDate completedDate;
        private DeadlineStatus deadlineStatus;
        private String completionLabel; // "Completed on time" / "Completed late" / null
        private String deadlineLabel;   // for UI
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;
        private long commentCount;
        // Review transition
        private Long movedToReviewBy;
        private String movedToReviewByName;
        private LocalDateTime movedToReviewAt;
        // Generic fields
        private String labels;
        private Integer storyPoints;
        private String sprint;
        private String components;
        private Long parentId;
        private String parentKey;
        private long subtaskCount;
        private long linkedCount;
        private long watcherCount;
        private boolean watchedByCurrentUser;
        private long attachmentCount;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UpdateStatusRequest {
        @NotNull
        private String status;
        private Long userId; // who triggered
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UpdateAssigneeRequest {
        private Long assigneeId;
        private Long userId;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class UpdatePriorityRequest {
        @NotNull
        private Priority priority;
        private Long userId;
    }
}
