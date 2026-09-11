package com.jira.repository;

import com.jira.entity.Activity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ActivityRepository extends JpaRepository<Activity, Long> {
    List<Activity> findByIssueIdOrderByCreatedAtDesc(Long issueId);
    List<Activity> findByProjectIdOrderByCreatedAtDesc(Long projectId);
    List<Activity> findAllByOrderByCreatedAtDesc();
}
