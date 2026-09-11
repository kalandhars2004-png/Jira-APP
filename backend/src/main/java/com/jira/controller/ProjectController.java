package com.jira.controller;

import com.jira.dto.ApiResponse;
import com.jira.dto.ProjectDtos.*;
import com.jira.service.ProjectService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
public class ProjectController {

    private final ProjectService projectService;

    @PostMapping
    public ResponseEntity<ApiResponse<ProjectResponse>> create(@Valid @RequestBody CreateProjectRequest req) {
        ProjectResponse res = projectService.create(req);
        return ResponseEntity.ok(ApiResponse.success("Project created successfully", res));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ProjectResponse>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(projectService.getAll()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ProjectResponse>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getById(id)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ProjectResponse>> update(@PathVariable Long id, @Valid @RequestBody CreateProjectRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Project updated", projectService.update(id, req)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(@PathVariable Long id) {
        projectService.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Project deleted", null));
    }

    @GetMapping("/{id}/members")
    public ResponseEntity<ApiResponse<List<MemberResponse>>> getMembers(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(projectService.getMembers(id)));
    }

    @PostMapping("/{id}/members")
    public ResponseEntity<ApiResponse<MemberResponse>> addMember(@PathVariable Long id, @RequestBody AddMemberRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Member added", projectService.addMember(id, req)));
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<ApiResponse<Void>> removeMember(@PathVariable Long id, @PathVariable Long userId) {
        projectService.removeMember(id, userId);
        return ResponseEntity.ok(ApiResponse.success("Member removed", null));
    }
}
