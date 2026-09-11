package com.jira.entity;

import com.jira.enums.ProjectStatus;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "projects")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Project {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(name = "project_key", nullable = false, unique = true)
    private String key; // ECOM, CRM etc uppercase

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ProjectStatus status = ProjectStatus.ACTIVE;

    private Long createdBy;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    // For issue key generation - incremental counter
    @Builder.Default
    private Integer issueCounter = 0;

    // Generic workflow — can be any stages, stored as JSON array string
    @Column(length = 2000)
    @Builder.Default
    private String workflow = "[\"TODO\",\"IN_PROGRESS\",\"IN_REVIEW\",\"DONE\"]";

    // For onboarding: who are you? (software/product/marketing/personal/custom)
    @Column(length = 50)
    private String teamType;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = ProjectStatus.ACTIVE;
        if (issueCounter == null) issueCounter = 0;
        if (key != null) key = key.toUpperCase().trim();
        if (workflow == null || workflow.isBlank()) workflow = "[\"TODO\",\"IN_PROGRESS\",\"IN_REVIEW\",\"DONE\"]";
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        if (key != null) key = key.toUpperCase().trim();
    }
}
