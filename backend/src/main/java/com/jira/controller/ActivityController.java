package com.jira.controller;

import com.jira.dto.ActivityDtos.ActivityResponse;
import com.jira.dto.ApiResponse;
import com.jira.service.ActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class ActivityController {

    private final ActivityService activityService;

    @GetMapping("/api/issues/{issueId}/activity")
    public ResponseEntity<ApiResponse<List<ActivityResponse>>> getByIssue(@PathVariable Long issueId) {
        return ResponseEntity.ok(ApiResponse.success(activityService.getByIssueId(issueId)));
    }

    @GetMapping("/api/projects/{projectId}/activity")
    public ResponseEntity<ApiResponse<List<ActivityResponse>>> getByProject(@PathVariable Long projectId) {
        return ResponseEntity.ok(ApiResponse.success(activityService.getByProjectId(projectId)));
    }

    @GetMapping("/api/activity")
    public ResponseEntity<ApiResponse<List<ActivityResponse>>> getRecent(@RequestParam(defaultValue = "20") int limit) {
        return ResponseEntity.ok(ApiResponse.success(activityService.getRecent(limit)));
    }
}
