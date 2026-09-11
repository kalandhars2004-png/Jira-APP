package com.jira.entity;

import com.jira.enums.IssueType;
import com.jira.enums.Priority;
import com.jira.enums.Status;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "issues")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Issue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long projectId;

    @Column(nullable = false, unique = true)
    private String issueKey; // e.g., ECOM-101

    @Column(nullable = false)
    private String title;

    @Column(length = 3000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private IssueType issueType = IssueType.TASK;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Priority priority = Priority.MEDIUM;

    // Generic status — can be any workflow stage (TODO, IN_PROGRESS, etc.)
    @Column(nullable = false)
    @Builder.Default
    private String status = "TODO";

    private Long assigneeId;
    private Long reporterId;

    // For subtasks — parent issue id
    private Long parentId;

    // DUE DATE SYSTEM
    @Column(nullable = false)
    private LocalDate dueDate;

    private LocalDate completedDate;

    // GENERIC JIRA FIELDS — can be anything (refer Jira)
    @Column(length = 500)
    private String labels; // comma-separated e.g. frontend,backend,urgent

    private Integer storyPoints;

    @Column(length = 100)
    private String sprint; // optional sprint name

    @Column(length = 100)
    private String components; // comma-separated components

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null || status.isBlank()) status = "TODO";
        if (priority == null) priority = Priority.MEDIUM;
        if (issueType == null) issueType = IssueType.TASK;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
