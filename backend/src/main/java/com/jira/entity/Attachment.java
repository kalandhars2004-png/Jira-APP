package com.jira.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "attachments")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Attachment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long issueId;

    @Column(nullable = false)
    private String fileName;

    private String fileType;
    private Long fileSize;
    private Long uploadedBy;
    private LocalDateTime uploadedAt;
    private String fileUrl; // for demo, may be placeholder

    @PrePersist
    protected void onCreate() {
        uploadedAt = LocalDateTime.now();
    }
}
