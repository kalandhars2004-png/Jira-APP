package com.jira.repository;

import com.jira.entity.Issue;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IssueRepository extends JpaRepository<Issue, Long> {
    List<Issue> findByProjectId(Long projectId);
    List<Issue> findByProjectIdAndStatus(Long projectId, String status);
    List<Issue> findByAssigneeId(Long assigneeId);
    List<Issue> findByProjectIdAndAssigneeId(Long projectId, Long assigneeId);
    List<Issue> findByParentId(Long parentId);
    long countByProjectId(Long projectId);
    long countByProjectIdAndStatus(Long projectId, String status);
    long countByParentId(Long parentId);
}
