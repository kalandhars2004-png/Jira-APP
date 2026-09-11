package com.jira.service;

import com.jira.dto.CommentDtos.*;
import com.jira.entity.Comment;
import com.jira.entity.User;
import com.jira.exception.ResourceNotFoundException;
import com.jira.repository.CommentRepository;
import com.jira.repository.IssueRepository;
import com.jira.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepo;
    private final IssueRepository issueRepo;
    private final UserRepository userRepo;
    private final ActivityService activityService;

    public CommentResponse addComment(Long issueId, CreateCommentRequest req) {
        if (!issueRepo.existsById(issueId)) throw new ResourceNotFoundException("Issue not found");
        Comment c = Comment.builder()
                .issueId(issueId)
                .userId(req.getUserId())
                .content(req.getContent())
                .build();
        c = commentRepo.save(c);

        // activity
        var issue = issueRepo.findById(issueId).orElse(null);
        String userName = userRepo.findById(req.getUserId()).map(User::getName).orElse("Someone");
        if (issue != null) {
            activityService.log(issueId, issue.getProjectId(), req.getUserId(),
                    "COMMENTED", userName + " commented on " + issue.getIssueKey());
        }

        return toResponse(c);
    }

    public List<CommentResponse> getByIssue(Long issueId) {
        if (!issueRepo.existsById(issueId)) throw new ResourceNotFoundException("Issue not found");
        return commentRepo.findByIssueIdOrderByCreatedAtAsc(issueId).stream()
                .map(this::toResponse).collect(Collectors.toList());
    }

    public CommentResponse updateComment(Long commentId, Long userId, String content) {
        Comment c = commentRepo.findById(commentId).orElseThrow(() -> new ResourceNotFoundException("Comment not found"));
        // Permission: only author or ADMIN can edit
        if (!c.getUserId().equals(userId)) {
            User requester = userRepo.findById(userId).orElse(null);
            if (requester == null || requester.getRole() != com.jira.enums.UserRole.ADMIN) {
                throw new IllegalArgumentException("Only author can edit comment");
            }
        }
        c.setContent(content);
        c = commentRepo.save(c);
        var issue = issueRepo.findById(c.getIssueId()).orElse(null);
        if (issue != null) {
            String userName = userRepo.findById(userId).map(User::getName).orElse("Someone");
            activityService.log(c.getIssueId(), issue.getProjectId(), userId, "COMMENT_EDITED", userName + " edited a comment on " + issue.getIssueKey());
        }
        return toResponse(c);
    }

    public void deleteComment(Long commentId, Long userId) {
        Comment c = commentRepo.findById(commentId).orElseThrow(() -> new ResourceNotFoundException("Comment not found"));
        if (!c.getUserId().equals(userId)) {
            User requester = userRepo.findById(userId).orElse(null);
            if (requester == null || requester.getRole() != com.jira.enums.UserRole.ADMIN) {
                throw new IllegalArgumentException("Only author can delete comment");
            }
        }
        commentRepo.delete(c);
        var issue = issueRepo.findById(c.getIssueId()).orElse(null);
        if (issue != null) {
            String userName = userRepo.findById(userId).map(User::getName).orElse("Someone");
            activityService.log(c.getIssueId(), issue.getProjectId(), userId, "COMMENT_DELETED", userName + " deleted a comment on " + issue.getIssueKey());
        }
    }

    private CommentResponse toResponse(Comment c) {
        User u = c.getUserId() != null ? userRepo.findById(c.getUserId()).orElse(null) : null;
        return CommentResponse.builder()
                .id(c.getId())
                .issueId(c.getIssueId())
                .userId(c.getUserId())
                .userName(u != null ? u.getName() : "Unknown")
                .userEmail(u != null ? u.getEmail() : "")
                .content(c.getContent())
                .createdAt(c.getCreatedAt())
                .build();
    }
}
