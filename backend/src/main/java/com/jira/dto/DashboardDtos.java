package com.jira.dto;

import lombok.*;
import java.util.List;

public class DashboardDtos {

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class DashboardResponse {
        private long totalProjects;
        private long totalIssues;
        private long openIssues;
        private long inProgress;
        private long inReview;
        private long completed;
        private long criticalIssues;
        // deadline stats
        private long overdue;
        private long dueToday;
        private long upcoming;
        private List<ProjectProgress> projectProgress;
        private List<ActivityDtos.ActivityResponse> recentActivity;
        private List<IssueDtos.IssueResponse> myIssues;
        private List<StatusDistribution> statusDistribution;
        private List<PriorityDistribution> priorityDistribution;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class ProjectProgress {
        private Long projectId;
        private String projectKey;
        private String projectName;
        private long total;
        private long completed;
        private int progress;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class StatusDistribution {
        private String status;
        private long count;
        private int percentage;
    }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class PriorityDistribution {
        private String priority;
        private long count;
    }
}
