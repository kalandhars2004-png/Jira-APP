package com.jira.controller;

import com.jira.dto.ApiResponse;
import com.jira.dto.IssueLinkDtos.*;
import com.jira.service.IssueLinkService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class IssueLinkController {
    private final IssueLinkService linkService;

    @PostMapping("/api/issues/{issueId}/links")
    public ResponseEntity<ApiResponse<LinkResponse>> createLink(@PathVariable Long issueId, @RequestBody CreateLinkRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Link created", linkService.createLink(issueId, req)));
    }

    @GetMapping("/api/issues/{issueId}/links")
    public ResponseEntity<ApiResponse<List<LinkResponse>>> getLinks(@PathVariable Long issueId) {
        return ResponseEntity.ok(ApiResponse.success(linkService.getLinks(issueId)));
    }

    @DeleteMapping("/api/issues/links/{linkId}")
    public ResponseEntity<ApiResponse<Void>> deleteLink(@PathVariable Long linkId, @RequestParam(required = false) Long userId, @RequestHeader(value = "X-User-Id", required = false) Long headerUserId) {
        Long uid = userId != null ? userId : headerUserId;
        linkService.deleteLink(linkId, uid);
        return ResponseEntity.ok(ApiResponse.success("Link removed", null));
    }
}
