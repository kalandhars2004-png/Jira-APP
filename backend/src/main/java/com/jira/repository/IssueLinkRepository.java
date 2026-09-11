package com.jira.repository;

import com.jira.entity.IssueLink;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IssueLinkRepository extends JpaRepository<IssueLink, Long> {
    List<IssueLink> findBySourceIssueId(Long sourceIssueId);
    List<IssueLink> findByTargetIssueId(Long targetIssueId);
    List<IssueLink> findBySourceIssueIdOrTargetIssueId(Long sourceId, Long targetId);
}
