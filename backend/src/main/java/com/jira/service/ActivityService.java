package com.jira.service;

import com.jira.dto.ActivityDtos.ActivityResponse;
import com.jira.entity.Activity;
import com.jira.entity.Issue;
import com.jira.entity.User;
import com.jira.repository.ActivityRepository;
import com.jira.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ActivityService {

    private final ActivityRepository activityRepo;
    private final UserRepository userRepo;

    public Activity log(Long issueId, Long projectId, Long userId, String action, String details) {
        Activity a = Activity.builder()
                .issueId(issueId)
                .projectId(projectId)
                .userId(userId)
                .action(action)
                .details(details)
                .build();
        return activityRepo.save(a);
    }

    public List<ActivityResponse> getByIssueId(Long issueId) {
        return activityRepo.findByIssueIdOrderByCreatedAtDesc(issueId).stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    public List<ActivityResponse> getByProjectId(Long projectId) {
        return activityRepo.findByProjectIdOrderByCreatedAtDesc(projectId).stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    public List<ActivityResponse> getRecent(int limit) {
        List<Activity> all = activityRepo.findAllByOrderByCreatedAtDesc();
        return all.stream().limit(limit).map(this::toResponse).collect(Collectors.toList());
    }

    private ActivityResponse toResponse(Activity a) {
        String userName = "System";
        if (a.getUserId() != null) {
            User u = userRepo.findById(a.getUserId()).orElse(null);
            if (u != null) userName = u.getName();
        }
        String issueKey = null;
        // issueKey lookup could be added if needed, keep simple
        return ActivityResponse.builder()
                .id(a.getId())
                .issueId(a.getIssueId())
                .projectId(a.getProjectId())
                .userId(a.getUserId())
                .userName(userName)
                .action(a.getAction())
                .details(a.getDetails())
                .createdAt(a.getCreatedAt())
                .build();
    }
}
