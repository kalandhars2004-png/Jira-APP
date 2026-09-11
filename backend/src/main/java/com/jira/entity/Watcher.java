package com.jira.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "watchers", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"issueId", "userId"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Watcher {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long issueId;

    @Column(nullable = false)
    private Long userId;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
