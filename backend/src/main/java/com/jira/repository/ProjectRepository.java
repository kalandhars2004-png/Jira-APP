package com.jira.repository;

import com.jira.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    Optional<Project> findByKey(String key);
    boolean existsByKey(String key);
}
