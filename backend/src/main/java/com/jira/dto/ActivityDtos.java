package com.jira.dto;

import lombok.*;
import java.time.LocalDateTime;

public class ActivityDtos {
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ActivityResponse {
        private Long id;
        private Long issueId;
        private String issueKey;
        private Long projectId;
        private Long userId;
        private String userName;
        private String action;
        private String details;
        private LocalDateTime createdAt;
    }
}
