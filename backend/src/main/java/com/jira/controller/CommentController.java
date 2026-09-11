package com.jira.controller;

import com.jira.dto.ApiResponse;
import com.jira.dto.CommentDtos.*;
import com.jira.service.CommentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @GetMapping("/api/issues/{issueId}/comments")
    public ResponseEntity<ApiResponse<List<CommentResponse>>> getComments(@PathVariable Long issueId) {
        return ResponseEntity.ok(ApiResponse.success(commentService.getByIssue(issueId)));
    }

    @PostMapping("/api/issues/{issueId}/comments")
    public ResponseEntity<ApiResponse<CommentResponse>> addComment(@PathVariable Long issueId, @Valid @RequestBody CreateCommentRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Comment added", commentService.addComment(issueId, req)));
    }

    @PutMapping("/api/comments/{commentId}")
    public ResponseEntity<ApiResponse<CommentResponse>> updateComment(@PathVariable Long commentId, @RequestBody CreateCommentRequest req) {
        return ResponseEntity.ok(ApiResponse.success("Comment updated", commentService.updateComment(commentId, req.getUserId(), req.getContent())));
    }

    @DeleteMapping("/api/comments/{commentId}")
    public ResponseEntity<ApiResponse<Void>> deleteComment(@PathVariable Long commentId, @RequestParam(required = false) Long userId, @RequestHeader(value = "X-User-Id", required = false) Long headerUserId) {
        Long uid = userId != null ? userId : headerUserId;
        commentService.deleteComment(commentId, uid);
        return ResponseEntity.ok(ApiResponse.success("Comment deleted", null));
    }
}
