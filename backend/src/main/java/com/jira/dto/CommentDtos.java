package com.jira.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;
import java.time.LocalDateTime;

public class CommentDtos {
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateCommentRequest {
        @NotBlank
        private String content;
        private Long userId;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CommentResponse {
        private Long id;
        private Long issueId;
        private Long userId;
        private String userName;
        private String userEmail;
        private String content;
        private LocalDateTime createdAt;
    }
}
