package com.jira.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "issue_links")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class IssueLink {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long sourceIssueId;

    @Column(nullable = false)
    private Long targetIssueId;

    @Column(nullable = false)
    private String linkType; // BLOCKS, IS_BLOCKED_BY, RELATES_TO, DUPLICATES

    private Long createdBy;
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
