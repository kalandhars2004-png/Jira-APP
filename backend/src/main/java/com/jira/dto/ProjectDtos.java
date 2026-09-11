package com.jira.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

public class ProjectDtos {

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class CreateProjectRequest {
        @NotBlank @Size(min=2, max=100)
        private String name;
        @NotBlank @Size(min=2, max=10)
        private String key;
        private String description;
        private Long createdBy;
        private List<String> workflow; // e.g. ["TODO","IN_PROGRESS","DONE"] or custom
        private String teamType; // software/product/marketing/personal/custom
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ProjectResponse {
        private Long id;
        private String name;
        private String key;
        private String description;
        private String status;
        private Long createdBy;
        private String createdByName;
        private LocalDateTime createdAt;
        private int memberCount;
        private int issueCount;
        private int completedCount;
        private int progress; // 0-100
        private List<String> workflow;
        private String teamType;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class AddMemberRequest {
        private Long userId;
        private String role; // PROJECT_MANAGER etc
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class MemberResponse {
        private Long projectId;
        private Long userId;
        private String name;
        private String email;
        private String role;
        private String joinedAt;
        private long assignedIssues;
    }
}
