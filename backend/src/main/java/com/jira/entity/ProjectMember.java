package com.jira.entity;

import com.jira.enums.ProjectRole;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "project_members", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"projectId", "userId"})
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ProjectMember {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long projectId;

    @Column(nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private ProjectRole role = ProjectRole.MEMBER;

    private LocalDateTime joinedAt;

    @PrePersist
    protected void onCreate() {
        joinedAt = LocalDateTime.now();
        if (role == null) role = ProjectRole.MEMBER;
    }
}
