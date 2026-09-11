package com.jira.controller;

import com.jira.dto.ApiResponse;
import com.jira.dto.IssueDtos.*;
import com.jira.service.IssueService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/issues")
@RequiredArgsConstructor
public class IssueController {

    private final IssueService issueService;

    @PostMapping
    public ResponseEntity<ApiResponse<IssueResponse>> create(@Valid @RequestBody CreateIssueRequest req) {
        IssueResponse res = issueService.create(req);
        return ResponseEntity.ok(ApiResponse.success("Issue created successfully", res));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<IssueResponse>>> getAll(
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String assignee,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String deadlineStatus,
            @RequestParam(required = false) Long userId
    ) {
        // if any filter present, use search
        if (search != null || assignee != null || priority != null || status != null || deadlineStatus != null) {
            List<IssueResponse> filtered = issueService.search(projectId, search, assignee, priority, status, deadlineStatus, userId);
            return ResponseEntity.ok(ApiResponse.success(filtered));
        }
        if (projectId != null) {
            return ResponseEntity.ok(ApiResponse.success(issueService.getByProjectId(projectId)));
        }
        return ResponseEntity.ok(ApiResponse.success(issueService.getAll()));
    }

    // Support spec's POST /api/issues and PUT /api/issues/{id} plus project scoped GET
    @GetMapping("/project/{projectId}")
    public ResponseEntity<ApiResponse<List<IssueResponse>>> getByProject(@PathVariable Long projectId) {
        return ResponseEntity.ok(ApiResponse.success(issueService.getByProjectId(projectId)));
    }

    @GetMapping("/projects/{projectId}/issues")
    public ResponseEntity<ApiResponse<List<IssueResponse>>> getByProjectAlt(@PathVariable Long projectId) {
        return ResponseEntity.ok(ApiResponse.success(issueService.getByProjectId(projectId)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<IssueResponse>> getById(@PathVariable Long id,
                                                              @RequestParam(required = false) Long userId,
                                                              @RequestHeader(value = "X-User-Id", required = false) Long headerUserId) {
        Long uid = userId != null ? userId : headerUserId;
        if (uid != null) {
            return ResponseEntity.ok(ApiResponse.success(issueService.getByIdWithPermission(id, uid)));
        }
        return ResponseEntity.ok(ApiResponse.success(issueService.getById(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<IssueResponse>> update(@PathVariable Long id, @RequestBody UpdateIssueRequest req,
                                                             @RequestParam(required = false) Long userId,
                                                             @RequestHeader(value = "X-User-Id", required = false) Long headerUserId) {
        Long uid = userId != null ? userId : headerUserId;
        return ResponseEntity.ok(ApiResponse.success("Issue updated", issueService.update(id, req, uid)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id,
                                                    @RequestParam(required = false) Long userId,
                                                    @RequestHeader(value = "X-User-Id", required = false) Long headerUserId) {
        Long uid = userId != null ? userId : headerUserId;
        if (uid != null) {
            issueService.deleteWithPermission(id, uid);
        } else {
            issueService.delete(id);
        }
        return ResponseEntity.ok(ApiResponse.success("Issue deleted", null));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<ApiResponse<IssueResponse>> updateStatus(@PathVariable Long id, @Valid @RequestBody UpdateStatusRequest req) {
        IssueResponse res = issueService.updateStatus(id, req.getStatus(), req.getUserId());
        return ResponseEntity.ok(ApiResponse.success("Status updated", res));
    }

    @PatchMapping("/{id}/assignee")
    public ResponseEntity<ApiResponse<IssueResponse>> updateAssignee(@PathVariable Long id, @RequestBody UpdateAssigneeRequest req) {
        IssueResponse res = issueService.updateAssignee(id, req.getAssigneeId(), req.getUserId());
        return ResponseEntity.ok(ApiResponse.success("Assignee updated", res));
    }

    @PatchMapping("/{id}/priority")
    public ResponseEntity<ApiResponse<IssueResponse>> updatePriority(@PathVariable Long id, @Valid @RequestBody UpdatePriorityRequest req) {
        IssueResponse res = issueService.updatePriority(id, req.getPriority(), req.getUserId());
        return ResponseEntity.ok(ApiResponse.success("Priority updated", res));
    }

    @GetMapping("/assignee/{userId}")
    public ResponseEntity<ApiResponse<List<IssueResponse>>> getByAssignee(@PathVariable Long userId) {
        return ResponseEntity.ok(ApiResponse.success(issueService.getByAssignee(userId)));
    }

    // Spec: GET /api/issues/my — backend must filter by authenticated user (DB query, not frontend)
    @GetMapping("/my")
    public ResponseEntity<ApiResponse<List<IssueResponse>>> getMyIssuesForCurrentUser(
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long projectId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String priority,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String dueDate) {
        Long uid = headerUserId != null ? headerUserId : userId;
        if (uid == null) throw new com.jira.exception.ForbiddenException("Authentication required");
        // Use DB query via service: find where assigneeId == uid
        List<IssueResponse> myIssues = issueService.getByAssignee(uid);
        // Apply optional filters server-side
        if (projectId != null) myIssues = myIssues.stream().filter(i -> projectId.equals(i.getProjectId())).collect(java.util.stream.Collectors.toList());
        if (status != null && !status.isBlank()) myIssues = myIssues.stream().filter(i -> status.equalsIgnoreCase(i.getStatus())).collect(java.util.stream.Collectors.toList());
        if (priority != null && !priority.isBlank()) myIssues = myIssues.stream().filter(i -> priority.equalsIgnoreCase(i.getPriority().name())).collect(java.util.stream.Collectors.toList());
        if (search != null && !search.isBlank()) {
            String q = search.toLowerCase();
            myIssues = myIssues.stream().filter(i -> i.getTitle().toLowerCase().contains(q) || (i.getDescription()!=null && i.getDescription().toLowerCase().contains(q)) || i.getIssueKey().toLowerCase().contains(q)).collect(java.util.stream.Collectors.toList());
        }
        return ResponseEntity.ok(ApiResponse.success(myIssues));
    }

    @GetMapping("/my/user/{userId}")
    public ResponseEntity<ApiResponse<List<IssueResponse>>> getMyIssuesLegacy(@PathVariable Long userId) {
        return ResponseEntity.ok(ApiResponse.success(issueService.getByAssignee(userId)));
    }

    @GetMapping("/{id}/subtasks")
    public ResponseEntity<ApiResponse<List<IssueResponse>>> getSubtasks(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(issueService.getSubtasks(id)));
    }

    @GetMapping("/{id}/parent")
    public ResponseEntity<ApiResponse<IssueResponse>> getParent(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(issueService.getParent(id)));
    }
}
