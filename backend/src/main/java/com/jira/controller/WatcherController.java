package com.jira.controller;

import com.jira.dto.ApiResponse;
import com.jira.dto.WatcherDtos.WatcherResponse;
import com.jira.service.WatcherService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class WatcherController {
    private final WatcherService watcherService;

    @PostMapping("/api/issues/{issueId}/watchers")
    public ResponseEntity<ApiResponse<WatcherResponse>> addWatcher(@PathVariable Long issueId, @RequestParam Long userId) {
        return ResponseEntity.ok(ApiResponse.success("Watching", watcherService.addWatcher(issueId, userId)));
    }

    @DeleteMapping("/api/issues/{issueId}/watchers/{userId}")
    public ResponseEntity<ApiResponse<Void>> removeWatcher(@PathVariable Long issueId, @PathVariable Long userId) {
        watcherService.removeWatcher(issueId, userId);
        return ResponseEntity.ok(ApiResponse.success("Unwatched", null));
    }

    @GetMapping("/api/issues/{issueId}/watchers")
    public ResponseEntity<ApiResponse<List<WatcherResponse>>> getWatchers(@PathVariable Long issueId) {
        return ResponseEntity.ok(ApiResponse.success(watcherService.getWatchers(issueId)));
    }

    @GetMapping("/api/issues/{issueId}/watchers/check")
    public ResponseEntity<ApiResponse<Boolean>> isWatching(@PathVariable Long issueId, @RequestParam Long userId) {
        return ResponseEntity.ok(ApiResponse.success(watcherService.isWatching(issueId, userId)));
    }
}
