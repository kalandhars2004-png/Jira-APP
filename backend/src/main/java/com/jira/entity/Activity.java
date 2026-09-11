package com.jira.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "activities")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Activity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long issueId;
    private Long projectId;
    private Long userId;

    @Column(nullable = false)
    private String action; // e.g., CREATED, STATUS_CHANGED, ASSIGNED, PRIORITY_CHANGED, COMMENTED

    @Column(length = 1000)
    private String details; // human readable

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
