package com.jira.dto;

import lombok.*;
import java.time.LocalDateTime;

public class IssueLinkDtos {
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateLinkRequest {
        private Long targetIssueId;
        private String linkType; // BLOCKS, IS_BLOCKED_BY, RELATES_TO, DUPLICATES
        private Long createdBy;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class LinkResponse {
        private Long id;
        private Long sourceIssueId;
        private String sourceKey;
        private Long targetIssueId;
        private String targetKey;
        private String targetTitle;
        private String linkType;
        private Long createdBy;
        private String createdByName;
        private LocalDateTime createdAt;
    }
}
