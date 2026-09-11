package com.jira.dto;

import lombok.*;
import java.time.LocalDateTime;

public class WatcherDtos {
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class WatcherResponse {
        private Long id;
        private Long issueId;
        private Long userId;
        private String userName;
        private String userEmail;
        private LocalDateTime createdAt;
    }
}
