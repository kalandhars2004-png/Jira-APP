package com.jira.controller;

import com.jira.dto.ApiResponse;
import com.jira.dto.IssueDtos.IssueResponse;
import com.jira.service.IssueService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}/issues")
@RequiredArgsConstructor
public class ProjectIssueController {

    private final IssueService issueService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<IssueResponse>>> getIssues(@PathVariable Long projectId,
                                                                       @RequestParam(required = false) String search,
                                                                       @RequestParam(required = false) String assignee,
                                                                       @RequestParam(required = false) String priority,
                                                                       @RequestParam(required = false) String status,
                                                                       @RequestParam(required = false) String deadlineStatus,
                                                                       @RequestParam(required = false) Long userId) {
        if (search != null || assignee != null || priority != null || status != null || deadlineStatus != null) {
            return ResponseEntity.ok(ApiResponse.success(issueService.search(projectId, search, assignee, priority, status, deadlineStatus, userId)));
        }
        return ResponseEntity.ok(ApiResponse.success(issueService.getByProjectId(projectId)));
    }
}
