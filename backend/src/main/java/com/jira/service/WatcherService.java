package com.jira.service;

import com.jira.dto.WatcherDtos.WatcherResponse;
import com.jira.entity.Watcher;
import com.jira.entity.User;
import com.jira.exception.ResourceNotFoundException;
import com.jira.repository.IssueRepository;
import com.jira.repository.UserRepository;
import com.jira.repository.WatcherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WatcherService {
    private final WatcherRepository watcherRepo;
    private final IssueRepository issueRepo;
    private final UserRepository userRepo;

    public WatcherResponse addWatcher(Long issueId, Long userId) {
        if (!issueRepo.existsById(issueId)) throw new ResourceNotFoundException("Issue not found");
        if (watcherRepo.existsByIssueIdAndUserId(issueId, userId)) {
            throw new IllegalArgumentException("Already watching");
        }
        Watcher w = Watcher.builder().issueId(issueId).userId(userId).build();
        w = watcherRepo.save(w);
        return toResponse(w);
    }

    public void removeWatcher(Long issueId, Long userId) {
        if (!watcherRepo.existsByIssueIdAndUserId(issueId, userId)) throw new ResourceNotFoundException("Watcher not found");
        watcherRepo.deleteByIssueIdAndUserId(issueId, userId);
    }

    public List<WatcherResponse> getWatchers(Long issueId) {
        return watcherRepo.findByIssueId(issueId).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public boolean isWatching(Long issueId, Long userId) {
        return watcherRepo.existsByIssueIdAndUserId(issueId, userId);
    }

    private WatcherResponse toResponse(Watcher w) {
        User u = userRepo.findById(w.getUserId()).orElse(null);
        return WatcherResponse.builder()
                .id(w.getId())
                .issueId(w.getIssueId())
                .userId(w.getUserId())
                .userName(u != null ? u.getName() : "Unknown")
                .userEmail(u != null ? u.getEmail() : "")
                .createdAt(w.getCreatedAt())
                .build();
    }
}
