package com.jira.service;

import com.jira.dto.ProjectDtos.*;
import com.jira.entity.Project;
import com.jira.entity.ProjectMember;
import com.jira.entity.User;
import com.jira.enums.ProjectRole;
import com.jira.enums.ProjectStatus;
import com.jira.exception.ResourceNotFoundException;
import com.jira.repository.IssueRepository;
import com.jira.repository.ProjectMemberRepository;
import com.jira.repository.ProjectRepository;
import com.jira.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProjectService {

    private final ProjectRepository projectRepo;
    private final ProjectMemberRepository memberRepo;
    private final UserRepository userRepo;
    private final IssueRepository issueRepo;

    public ProjectResponse create(CreateProjectRequest req) {
        String key = req.getKey().toUpperCase().trim();
        if (projectRepo.existsByKey(key)) {
            throw new IllegalArgumentException("Project key already exists: " + key);
        }
        // Handle generic workflow
        String workflowJson = toWorkflowJson(req.getWorkflow());
        Project p = Project.builder()
                .name(req.getName())
                .key(key)
                .description(req.getDescription())
                .status(ProjectStatus.ACTIVE)
                .createdBy(req.getCreatedBy())
                .issueCounter(0)
                .workflow(workflowJson)
                .teamType(req.getTeamType())
                .build();
        p = projectRepo.save(p);

        // auto add creator as PROJECT_MANAGER member
        if (req.getCreatedBy() != null) {
            ProjectMember pm = ProjectMember.builder()
                    .projectId(p.getId())
                    .userId(req.getCreatedBy())
                    .role(ProjectRole.PROJECT_MANAGER)
                    .build();
            memberRepo.save(pm);
        }
        return toResponse(p);
    }

    public List<ProjectResponse> getAll() {
        return projectRepo.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    public ProjectResponse getById(Long id) {
        Project p = projectRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Project not found"));
        return toResponse(p);
    }

    public Project getEntityById(Long id) {
        return projectRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Project not found"));
    }

    public ProjectResponse update(Long id, CreateProjectRequest req) {
        Project p = getEntityById(id);
        p.setName(req.getName());
        p.setDescription(req.getDescription());
        // key update allowed but check uniqueness
        if (req.getKey() != null && !req.getKey().equalsIgnoreCase(p.getKey())) {
            String newKey = req.getKey().toUpperCase().trim();
            if (projectRepo.existsByKey(newKey)) throw new IllegalArgumentException("Project key already exists");
            p.setKey(newKey);
        }
        if (req.getWorkflow() != null && !req.getWorkflow().isEmpty()) {
            p.setWorkflow(toWorkflowJson(req.getWorkflow()));
        }
        if (req.getTeamType() != null) p.setTeamType(req.getTeamType());
        p = projectRepo.save(p);
        return toResponse(p);
    }

    @Transactional
    public void delete(Long id) {
        Project p = getEntityById(id);
        // delete members and issues? for simplicity delete members, keep issues? But spec says handle related data.
        // We'll delete members and issues belonging to this project
        memberRepo.findByProjectId(id).forEach(m -> memberRepo.delete(m));
        issueRepo.findByProjectId(id).forEach(i -> issueRepo.delete(i));
        projectRepo.delete(p);
    }

    public List<MemberResponse> getMembers(Long projectId) {
        getEntityById(projectId); // ensure exists
        List<ProjectMember> members = memberRepo.findByProjectId(projectId);
        return members.stream().map(m -> {
            User u = userRepo.findById(m.getUserId()).orElse(null);
            long assigned = issueRepo.findByProjectIdAndAssigneeId(projectId, m.getUserId()).size();
            return MemberResponse.builder()
                    .projectId(projectId)
                    .userId(m.getUserId())
                    .name(u != null ? u.getName() : "Unknown")
                    .email(u != null ? u.getEmail() : "")
                    .role(m.getRole().name())
                    .joinedAt(m.getJoinedAt() != null ? m.getJoinedAt().toString() : "")
                    .assignedIssues(assigned)
                    .build();
        }).collect(Collectors.toList());
    }

    public MemberResponse addMember(Long projectId, AddMemberRequest req) {
        Project p = getEntityById(projectId);
        User u = userRepo.findById(req.getUserId()).orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (memberRepo.existsByProjectIdAndUserId(projectId, req.getUserId())) {
            throw new IllegalArgumentException("User already a member of this project");
        }
        ProjectRole role = ProjectRole.MEMBER;
        if (req.getRole() != null) {
            try { role = ProjectRole.valueOf(req.getRole().toUpperCase()); } catch (Exception e) { role = ProjectRole.MEMBER; }
        }
        ProjectMember pm = ProjectMember.builder()
                .projectId(projectId)
                .userId(req.getUserId())
                .role(role)
                .build();
        memberRepo.save(pm);
        return MemberResponse.builder()
                .projectId(projectId)
                .userId(u.getId())
                .name(u.getName())
                .email(u.getEmail())
                .role(role.name())
                .joinedAt(pm.getJoinedAt() != null ? pm.getJoinedAt().toString() : "")
                .assignedIssues(0)
                .build();
    }

    @Transactional
    public void removeMember(Long projectId, Long userId) {
        if (!memberRepo.existsByProjectIdAndUserId(projectId, userId)) {
            throw new ResourceNotFoundException("Member not found in project");
        }
        memberRepo.deleteByProjectIdAndUserId(projectId, userId);
    }

    private ProjectResponse toResponse(Project p) {
        long issueCount = issueRepo.countByProjectId(p.getId());
        // Generic: completed is last workflow stage
        List<String> wf = fromWorkflowJson(p.getWorkflow());
        String doneStatus = wf.isEmpty() ? "DONE" : wf.get(wf.size()-1);
        long completed = issueRepo.countByProjectIdAndStatus(p.getId(), doneStatus);
        int progress = issueCount == 0 ? 0 : (int) Math.round((completed * 100.0) / issueCount);
        int memberCount = memberRepo.findByProjectId(p.getId()).size();
        String creatorName = null;
        if (p.getCreatedBy() != null) {
            User u = userRepo.findById(p.getCreatedBy()).orElse(null);
            if (u != null) creatorName = u.getName();
        }
        return ProjectResponse.builder()
                .id(p.getId())
                .name(p.getName())
                .key(p.getKey())
                .description(p.getDescription())
                .status(p.getStatus() != null ? p.getStatus().name() : "ACTIVE")
                .createdBy(p.getCreatedBy())
                .createdByName(creatorName)
                .createdAt(p.getCreatedAt())
                .memberCount(memberCount)
                .issueCount((int) issueCount)
                .completedCount((int) completed)
                .progress(progress)
                .workflow(wf)
                .teamType(p.getTeamType())
                .build();
    }

    private String toWorkflowJson(List<String> workflow) {
        if (workflow == null || workflow.isEmpty()) return "[\"TODO\",\"IN_PROGRESS\",\"IN_REVIEW\",\"DONE\"]";
        // simple JSON array
        return workflow.stream().map(s -> "\"" + s.replace("\"","\\\"") + "\"").collect(Collectors.joining(",", "[", "]"));
    }
    private List<String> fromWorkflowJson(String json) {
        if (json == null || json.isBlank()) return List.of("TODO","IN_PROGRESS","IN_REVIEW","DONE");
        try {
            // very simple parse: remove brackets and quotes
            String t = json.trim();
            if (t.startsWith("[")) t = t.substring(1);
            if (t.endsWith("]")) t = t.substring(0, t.length()-1);
            if (t.isBlank()) return List.of("TODO","IN_PROGRESS","IN_REVIEW","DONE");
            return java.util.Arrays.stream(t.split(",")).map(s -> s.trim().replaceAll("^\"|\"$", "")).filter(s -> !s.isBlank()).collect(Collectors.toList());
        } catch (Exception e) {
            return List.of("TODO","IN_PROGRESS","IN_REVIEW","DONE");
        }
    }
}
