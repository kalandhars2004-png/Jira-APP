package com.jira.dto;

import lombok.*;
import java.time.LocalDateTime;

public class AttachmentDtos {
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateAttachmentRequest {
        private String fileName;
        private String fileType;
        private Long fileSize;
        private Long uploadedBy;
        private String fileUrl;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AttachmentResponse {
        private Long id;
        private Long issueId;
        private String fileName;
        private String fileType;
        private Long fileSize;
        private Long uploadedBy;
        private String uploadedByName;
        private LocalDateTime uploadedAt;
        private String fileUrl;
    }
}
