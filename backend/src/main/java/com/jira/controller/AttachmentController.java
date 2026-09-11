package com.jira.controller;

import com.jira.dto.ApiResponse;
import com.jira.dto.AttachmentDtos.*;
import com.jira.service.AttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class AttachmentController {
    private final AttachmentService attachmentService;

    @PostMapping("/api/issues/{issueId}/attachments")
    public ResponseEntity<ApiResponse<AttachmentResponse>> addAttachment(@PathVariable Long issueId, @RequestBody CreateAttachmentRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Attachment added", attachmentService.addAttachment(issueId, req)));
    }

    @GetMapping("/api/issues/{issueId}/attachments")
    public ResponseEntity<ApiResponse<List<AttachmentResponse>>> getAttachments(@PathVariable Long issueId) {
        return ResponseEntity.ok(ApiResponse.success(attachmentService.getAttachments(issueId)));
    }

    @DeleteMapping("/api/attachments/{attachmentId}")
    public ResponseEntity<ApiResponse<Void>> deleteAttachment(@PathVariable Long attachmentId, @RequestParam(required = false) Long userId, @RequestHeader(value = "X-User-Id", required = false) Long headerUserId) {
        Long uid = userId != null ? userId : headerUserId;
        attachmentService.deleteAttachment(attachmentId, uid);
        return ResponseEntity.ok(ApiResponse.success("Attachment deleted", null));
    }
}
