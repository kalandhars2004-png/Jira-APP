package com.jira.service;

import com.jira.dto.IssueLinkDtos.*;
import com.jira.entity.IssueLink;
import com.jira.entity.User;
import com.jira.exception.ResourceNotFoundException;
import com.jira.repository.IssueLinkRepository;
import com.jira.repository.IssueRepository;
import com.jira.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IssueLinkService {
    private final IssueLinkRepository linkRepo;
    private final IssueRepository issueRepo;
    private final UserRepository userRepo;
    private final ActivityService activityService;

    public LinkResponse createLink(Long sourceIssueId, CreateLinkRequest req) {
        if (!issueRepo.existsById(sourceIssueId)) throw new ResourceNotFoundException("Source issue not found");
        if (!issueRepo.existsById(req.getTargetIssueId())) throw new ResourceNotFoundException("Target issue not found");
        if (sourceIssueId.equals(req.getTargetIssueId())) throw new IllegalArgumentException("Cannot link issue to itself");

        IssueLink link = IssueLink.builder()
                .sourceIssueId(sourceIssueId)
                .targetIssueId(req.getTargetIssueId())
                .linkType(req.getLinkType() != null ? req.getLinkType() : "RELATES_TO")
                .createdBy(req.getCreatedBy())
                .build();
        link = linkRepo.save(link);

        var source = issueRepo.findById(sourceIssueId).orElse(null);
        var target = issueRepo.findById(req.getTargetIssueId()).orElse(null);
        if (source != null) {
            String userName = getUserName(req.getCreatedBy());
            activityService.log(sourceIssueId, source.getProjectId(), req.getCreatedBy(), "LINKED", userName + " linked " + source.getIssueKey() + " to " + (target != null ? target.getIssueKey() : req.getTargetIssueId()) + " (" + link.getLinkType() + ")");
        }

        return toResponse(link);
    }

    public List<LinkResponse> getLinks(Long issueId) {
        return linkRepo.findBySourceIssueIdOrTargetIssueId(issueId, issueId).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public void deleteLink(Long linkId, Long userId) {
        IssueLink link = linkRepo.findById(linkId).orElseThrow(() -> new ResourceNotFoundException("Link not found"));
        linkRepo.delete(link);
        var source = issueRepo.findById(link.getSourceIssueId()).orElse(null);
        if (source != null) {
            String userName = getUserName(userId);
            activityService.log(link.getSourceIssueId(), source.getProjectId(), userId, "UNLINKED", userName + " removed link " + link.getLinkType() + " between " + link.getSourceIssueId() + " and " + link.getTargetIssueId());
        }
    }

    private LinkResponse toResponse(IssueLink link) {
        var source = issueRepo.findById(link.getSourceIssueId()).orElse(null);
        var target = issueRepo.findById(link.getTargetIssueId()).orElse(null);
        String createdByName = getUserName(link.getCreatedBy());
        return LinkResponse.builder()
                .id(link.getId())
                .sourceIssueId(link.getSourceIssueId())
                .sourceKey(source != null ? source.getIssueKey() : null)
                .targetIssueId(link.getTargetIssueId())
                .targetKey(target != null ? target.getIssueKey() : null)
                .targetTitle(target != null ? target.getTitle() : null)
                .linkType(link.getLinkType())
                .createdBy(link.getCreatedBy())
                .createdByName(createdByName)
                .createdAt(link.getCreatedAt())
                .build();
    }

    private String getUserName(Long userId) {
        if (userId == null) return "System";
        return userRepo.findById(userId).map(User::getName).orElse("Unknown");
    }
}
