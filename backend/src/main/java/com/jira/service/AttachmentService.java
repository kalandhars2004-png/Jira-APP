package com.jira.service;

import com.jira.dto.AttachmentDtos.*;
import com.jira.entity.Attachment;
import com.jira.entity.User;
import com.jira.exception.ResourceNotFoundException;
import com.jira.repository.AttachmentRepository;
import com.jira.repository.IssueRepository;
import com.jira.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AttachmentService {
    private final AttachmentRepository attachmentRepo;
    private final IssueRepository issueRepo;
    private final UserRepository userRepo;
    private final ActivityService activityService;

    public AttachmentResponse addAttachment(Long issueId, CreateAttachmentRequest req) {
        if (!issueRepo.existsById(issueId)) throw new ResourceNotFoundException("Issue not found");
        Attachment a = Attachment.builder()
                .issueId(issueId)
                .fileName(req.getFileName())
                .fileType(req.getFileType())
                .fileSize(req.getFileSize())
                .uploadedBy(req.getUploadedBy())
                .fileUrl(req.getFileUrl())
                .build();
        a = attachmentRepo.save(a);
        var issue = issueRepo.findById(issueId).orElse(null);
        if (issue != null) {
            String userName = userRepo.findById(req.getUploadedBy()).map(User::getName).orElse("Someone");
            activityService.log(issueId, issue.getProjectId(), req.getUploadedBy(), "ATTACHED", userName + " attached " + req.getFileName() + " to " + issue.getIssueKey());
        }
        return toResponse(a);
    }

    public List<AttachmentResponse> getAttachments(Long issueId) {
        return attachmentRepo.findByIssueId(issueId).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public void deleteAttachment(Long attachmentId, Long userId) {
        Attachment a = attachmentRepo.findById(attachmentId).orElseThrow(() -> new ResourceNotFoundException("Attachment not found"));
        // Permission: only uploader or ADMIN can delete
        if (!a.getUploadedBy().equals(userId)) {
            User requester = userRepo.findById(userId).orElse(null);
            if (requester == null || requester.getRole() != com.jira.enums.UserRole.ADMIN) {
                throw new IllegalArgumentException("Only uploader can delete attachment");
            }
        }
        attachmentRepo.delete(a);
        var issue = issueRepo.findById(a.getIssueId()).orElse(null);
        if (issue != null) {
            String userName = userRepo.findById(userId).map(User::getName).orElse("Someone");
            activityService.log(a.getIssueId(), issue.getProjectId(), userId, "ATTACHMENT_REMOVED", userName + " removed attachment " + a.getFileName() + " from " + issue.getIssueKey());
        }
    }

    private AttachmentResponse toResponse(Attachment a) {
        User u = a.getUploadedBy() != null ? userRepo.findById(a.getUploadedBy()).orElse(null) : null;
        return AttachmentResponse.builder()
                .id(a.getId())
                .issueId(a.getIssueId())
                .fileName(a.getFileName())
                .fileType(a.getFileType())
                .fileSize(a.getFileSize())
                .uploadedBy(a.getUploadedBy())
                .uploadedByName(u != null ? u.getName() : "Unknown")
                .uploadedAt(a.getUploadedAt())
                .fileUrl(a.getFileUrl())
                .build();
    }
}
