package com.jira.controller;

import com.jira.dto.ApiResponse;
import com.jira.dto.DashboardDtos.DashboardResponse;
import com.jira.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;

    @GetMapping
    public ResponseEntity<ApiResponse<DashboardResponse>> getDashboard(@RequestParam(required = false) Long userId,
                                                                        @RequestHeader(value = "X-User-Id", required = false) Long headerUserId) {
        Long uid = userId != null ? userId : headerUserId;
        return ResponseEntity.ok(ApiResponse.success(dashboardService.getDashboard(uid)));
    }

    @GetMapping("/stats")
    public ResponseEntity<ApiResponse<DashboardResponse>> getStats(@RequestParam(required = false) Long userId) {
        return ResponseEntity.ok(ApiResponse.success(dashboardService.getDashboard(userId)));
    }
}
