package com.jira.service;

import com.jira.dto.IssueDtos.*;
import com.jira.entity.Issue;
import com.jira.entity.Project;
import com.jira.entity.User;
import com.jira.enums.DeadlineStatus;
import com.jira.exception.ResourceNotFoundException;
import com.jira.repository.*;
import com.jira.util.DeadlineCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class IssueService {

    private final IssueRepository issueRepo;
    private final ProjectRepository projectRepo;
    private final UserRepository userRepo;
    private final CommentRepository commentRepo;
    private final ProjectMemberRepository memberRepo;
    private final ActivityService activityService;
    private final IssueLinkRepository issueLinkRepo;
    private final WatcherRepository watcherRepo;
    private final AttachmentRepository attachmentRepo;

    @Transactional
    public IssueResponse create(CreateIssueRequest req) {
        Project project = projectRepo.findById(req.getProjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Project not found"));

        if (req.getDueDate() == null) {
            throw new IllegalArgumentException("Due date and time is required - Every issue must have a due date and time");
        }
        if (req.getDueDate().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("Due date and time must be in the future");
        }

        if (req.getAssigneeId() != null && !memberRepo.existsByProjectIdAndUserId(req.getProjectId(), req.getAssigneeId())) {
            // For generic assignment, allow any registered user (per spec: Any registered user should be available)
            // So we relax: if not member, still allow but log warning
            // throw new IllegalArgumentException("Assignee must be a member of the project");
        }

        int next = project.getIssueCounter() == null ? 1 : project.getIssueCounter() + 1;
        project.setIssueCounter(next);
        projectRepo.save(project);
        String issueKey = project.getKey() + "-" + next;

        String status = req.getStatus() != null ? req.getStatus() : "TODO";
        // Validate status is in project's workflow if workflow exists
        // Allow any, but if workflow exists, ensure status is one of them; if not, default to first
        List<String> wf = parseWorkflow(project.getWorkflow());
        if (!wf.isEmpty() && !wf.contains(status)) {
            status = wf.get(0);
        }

        Issue issue = Issue.builder()
                .projectId(req.getProjectId())
                .issueKey(issueKey)
                .title(req.getTitle())
                .description(req.getDescription())
                .issueType(req.getIssueType() != null ? req.getIssueType() : com.jira.enums.IssueType.TASK)
                .priority(req.getPriority() != null ? req.getPriority() : com.jira.enums.Priority.MEDIUM)
                .status(status)
                .assigneeId(req.getAssigneeId())
                .reporterId(req.getReporterId())
                .dueDate(req.getDueDate())
                .labels(req.getLabels())
                .storyPoints(req.getStoryPoints())
                .sprint(req.getSprint())
                .components(req.getComponents())
                .parentId(req.getParentId())
                .build();

        if (isDoneStatus(issue.getStatus(), wf)) {
            issue.setCompletedDate(LocalDate.now());
        }
        if (isReviewStatus(issue.getStatus())) {
            issue.setMovedToReviewBy(req.getReporterId());
            issue.setMovedToReviewAt(LocalDateTime.now());
        }

        issue = issueRepo.save(issue);

        String reporterName = getUserName(req.getReporterId());
        activityService.log(issue.getId(), issue.getProjectId(), req.getReporterId(),
                "CREATED", reporterName + " created " + issueKey);

        if (req.getAssigneeId() != null) {
            String assigneeName = getUserName(req.getAssigneeId());
            activityService.log(issue.getId(), issue.getProjectId(), req.getReporterId(),
                    "ASSIGNED", reporterName + " assigned " + issueKey + " to " + assigneeName);
        }

        return toResponse(issue);
    }

    public List<IssueResponse> getByProjectId(Long projectId) {
        return issueRepo.findByProjectId(projectId).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<IssueResponse> getAll() {
        return issueRepo.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    public IssueResponse getById(Long id) {
        Issue issue = issueRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Issue not found"));
        return toResponse(issue);
    }

    public IssueResponse getByIdWithPermission(Long id, Long userId) {
        Issue issue = issueRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Issue not found"));
        checkViewPermission(issue, userId);
        return toResponse(issue);
    }

    private void checkViewPermission(Issue issue, Long userId) {
        if (userId == null) return; // allow for now if no user
        User user = userRepo.findById(userId).orElse(null);
        if (user != null && user.getRole() == com.jira.enums.UserRole.ADMIN) return;
        boolean isMember = memberRepo.existsByProjectIdAndUserId(issue.getProjectId(), userId);
        if (isMember) return;
        // also allow if user is assignee or reporter
        if (issue.getAssigneeId() != null && issue.getAssigneeId().equals(userId)) return;
        if (issue.getReporterId() != null && issue.getReporterId().equals(userId)) return;
        throw new com.jira.exception.ForbiddenException("You do not have permission to view this issue");
    }

    public Issue getEntityById(Long id) {
        return issueRepo.findById(id).orElseThrow(() -> new ResourceNotFoundException("Issue not found"));
    }

    private void checkEditPermission(Issue issue, Long userId) {
        // Strict creator-only permission: only the user who created the issue (reporterId) or ADMIN can edit
        // DO NOT use assigneeId for permission — spec: currentUser.id === issue.createdById
        if (userId == null) throw new com.jira.exception.ForbiddenException("Authentication required");
        User user = userRepo.findById(userId).orElseThrow(() -> new com.jira.exception.ForbiddenException("User not found"));
        if (user.getRole() == com.jira.enums.UserRole.ADMIN) return;
        if (issue.getReporterId() != null && issue.getReporterId().equals(userId)) return;
        throw new com.jira.exception.ForbiddenException("Only the creator can edit this issue");
    }

    private void checkStatusChangePermission(Issue issue, Long userId) {
        // Assignee may move through workflow via board drag, creator and admin can also
        if (userId == null) throw new com.jira.exception.ForbiddenException("Authentication required");
        User user = userRepo.findById(userId).orElseThrow(() -> new com.jira.exception.ForbiddenException("User not found"));
        if (user.getRole() == com.jira.enums.UserRole.ADMIN) return;
        if (issue.getReporterId() != null && issue.getReporterId().equals(userId)) return;
        if (issue.getAssigneeId() != null && issue.getAssigneeId().equals(userId)) return;
        throw new com.jira.exception.ForbiddenException("Only creator or assignee can change status");
    }

    @Transactional
    public IssueResponse update(Long id, UpdateIssueRequest req, Long userId) {
        Issue issue = getEntityById(id);
        checkEditPermission(issue, userId);
        String issueKey = issue.getIssueKey();
        Project project = projectRepo.findById(issue.getProjectId()).orElse(null);
        List<String> wf = project != null ? parseWorkflow(project.getWorkflow()) : List.of("TODO","IN_PROGRESS","IN_REVIEW","DONE");

        if (req.getAssigneeId() != null && !req.getAssigneeId().equals(issue.getAssigneeId())) {
            String oldName = getUserName(issue.getAssigneeId());
            String newName = getUserName(req.getAssigneeId());
            String actor = getUserName(userId);
            activityService.log(issue.getId(), issue.getProjectId(), userId,
                    "ASSIGNED", actor + " assigned " + issueKey + " from " + oldName + " to " + newName);
            issue.setAssigneeId(req.getAssigneeId());
        } else if (req.getAssigneeId() == null && issue.getAssigneeId() != null) {
            // allow unassign
            String oldName = getUserName(issue.getAssigneeId());
            String actor = getUserName(userId);
            activityService.log(issue.getId(), issue.getProjectId(), userId,
                    "UNASSIGNED", actor + " unassigned " + issueKey + " from " + oldName);
            issue.setAssigneeId(null);
        }

        if (req.getPriority() != null && req.getPriority() != issue.getPriority()) {
            String actor = getUserName(userId);
            activityService.log(issue.getId(), issue.getProjectId(), userId,
                    "PRIORITY_CHANGED", actor + " changed priority of " + issueKey + " from " + issue.getPriority() + " to " + req.getPriority());
            issue.setPriority(req.getPriority());
        }

        if (req.getStatus() != null && !req.getStatus().equalsIgnoreCase(issue.getStatus())) {
            handleStatusChange(issue, req.getStatus(), userId, wf);
        }

        if (req.getTitle() != null) {
            String oldTitle = issue.getTitle();
            if (!oldTitle.equals(req.getTitle())) {
                activityService.log(issue.getId(), issue.getProjectId(), userId, "TITLE_CHANGED", getUserName(userId) + " changed title from '" + oldTitle + "' to '" + req.getTitle() + "'");
            }
            issue.setTitle(req.getTitle());
        }
        if (req.getDescription() != null && !req.getDescription().equals(issue.getDescription())) {
            activityService.log(issue.getId(), issue.getProjectId(), userId, "DESCRIPTION_CHANGED", getUserName(userId) + " updated description of " + issueKey);
            issue.setDescription(req.getDescription());
        }
        if (req.getIssueType() != null) issue.setIssueType(req.getIssueType());
        if (req.getDueDate() != null && !req.getDueDate().equals(issue.getDueDate())) {
            activityService.log(issue.getId(), issue.getProjectId(), userId, "DUE_DATE_CHANGED", getUserName(userId) + " changed due date of " + issueKey + " from " + issue.getDueDate() + " to " + req.getDueDate());
            issue.setDueDate(req.getDueDate());
        }
        if (req.getLabels() != null && !req.getLabels().equals(issue.getLabels())) {
            activityService.log(issue.getId(), issue.getProjectId(), userId, req.getLabels() != null && req.getLabels().length() > (issue.getLabels() != null ? issue.getLabels().length() : 0) ? "LABEL_ADDED" : "LABEL_REMOVED", getUserName(userId) + " updated labels of " + issueKey + " to " + req.getLabels());
            issue.setLabels(req.getLabels());
        }
        if (req.getStoryPoints() != null) issue.setStoryPoints(req.getStoryPoints());
        if (req.getSprint() != null && !req.getSprint().equals(issue.getSprint())) {
            activityService.log(issue.getId(), issue.getProjectId(), userId, "SPRINT_CHANGED", getUserName(userId) + " moved " + issueKey + " to sprint " + req.getSprint());
            issue.setSprint(req.getSprint());
        }
        if (req.getComponents() != null) issue.setComponents(req.getComponents());
        if (req.getParentId() != null) issue.setParentId(req.getParentId());

        issue = issueRepo.save(issue);
        return toResponse(issue);
    }

    @Transactional
    public IssueResponse updateStatus(Long id, String newStatus, Long userId) {
        Issue issue = getEntityById(id);
        checkStatusChangePermission(issue, userId);
        // Validate workflow transition: must respect project's workflow order
        Project project = projectRepo.findById(issue.getProjectId()).orElse(null);
        List<String> wf = project != null ? parseWorkflow(project.getWorkflow()) : List.of("TODO","IN_PROGRESS","IN_REVIEW","DONE");
        // Allow only sequential or any? For strict workflow, check if newStatus is in workflow and is next or previous? For now allow any in workflow but log
        if (!wf.contains(newStatus)) throw new IllegalArgumentException("Invalid status for this project's workflow: " + newStatus);
        if (newStatus != null && !newStatus.equalsIgnoreCase(issue.getStatus())) {
            handleStatusChange(issue, newStatus, userId, wf);
            issue = issueRepo.save(issue);
        }
        return toResponse(issue);
    }

    private void handleStatusChange(Issue issue, String newStatus, Long userId, List<String> workflow) {
        String old = issue.getStatus();
        String actor = getUserName(userId);
        activityService.log(issue.getId(), issue.getProjectId(), userId,
                "STATUS_CHANGED", actor + " moved " + issue.getIssueKey() + " from " + old + " to " + newStatus);
        issue.setStatus(newStatus);
        // Track review transition — preserve who moved it to REVIEW and when
        if (isReviewStatus(newStatus)) {
            issue.setMovedToReviewBy(userId);
            issue.setMovedToReviewAt(LocalDateTime.now());
            activityService.log(issue.getId(), issue.getProjectId(), userId,
                    "MOVED_TO_REVIEW", actor + " moved " + issue.getIssueKey() + " to review");
        }
        if (isDoneStatus(newStatus, workflow)) {
            issue.setCompletedDate(LocalDate.now());
            boolean onTime = DeadlineCalculator.isCompletedOnTime(issue.getDueDate(), issue.getCompletedDate());
            String label = onTime ? "Completed on time" : "Completed late";
            activityService.log(issue.getId(), issue.getProjectId(), userId,
                    onTime ? "COMPLETED_ON_TIME" : "COMPLETED_LATE",
                    issue.getIssueKey() + " was " + label.toLowerCase() + " (Due: " + issue.getDueDate() + ", Completed: " + issue.getCompletedDate() + ")");
        } else {
            issue.setCompletedDate(null);
        }
    }

    private boolean isReviewStatus(String status) {
        if (status == null) return false;
        String s = status.toUpperCase();
        return s.equals("REVIEW") || s.equals("IN_REVIEW") || s.contains("REVIEW");
    }

    private boolean isDoneStatus(String status, List<String> workflow) {
        if (status == null) return false;
        if ("DONE".equalsIgnoreCase(status)) return true;
        if (workflow != null && !workflow.isEmpty()) {
            String last = workflow.get(workflow.size()-1);
            return last.equalsIgnoreCase(status);
        }
        return false;
    }

    private List<String> parseWorkflow(String json) {
        if (json == null || json.isBlank()) return List.of("TODO","IN_PROGRESS","IN_REVIEW","DONE");
        try {
            String t = json.trim();
            if (t.startsWith("[")) t = t.substring(1);
            if (t.endsWith("]")) t = t.substring(0, t.length()-1);
            if (t.isBlank()) return List.of("TODO","IN_PROGRESS","IN_REVIEW","DONE");
            return java.util.Arrays.stream(t.split(",")).map(s -> s.trim().replaceAll("^\"|\"$", "")).filter(s -> !s.isBlank()).collect(Collectors.toList());
        } catch (Exception e) {
            return List.of("TODO","IN_PROGRESS","IN_REVIEW","DONE");
        }
    }

    @Transactional
    public IssueResponse updateAssignee(Long id, Long assigneeId, Long userId) {
        Issue issue = getEntityById(id);
        checkEditPermission(issue, userId);
        String oldName = getUserName(issue.getAssigneeId());
        String newName = getUserName(assigneeId);
        String actor = getUserName(userId);
        if (assigneeId == null) {
            activityService.log(issue.getId(), issue.getProjectId(), userId,
                    "UNASSIGNED", actor + " unassigned " + issue.getIssueKey() + " from " + oldName);
        } else {
            activityService.log(issue.getId(), issue.getProjectId(), userId,
                    "ASSIGNED", actor + " assigned " + issue.getIssueKey() + " to " + newName);
        }
        issue.setAssigneeId(assigneeId);
        issue = issueRepo.save(issue);
        // After reassignment, old assignee loses edit, new gains — handled via permission check on next edit
        return toResponse(issue);
    }

    @Transactional
    public IssueResponse updatePriority(Long id, com.jira.enums.Priority priority, Long userId) {
        Issue issue = getEntityById(id);
        checkEditPermission(issue, userId);
        String actor = getUserName(userId);
        activityService.log(issue.getId(), issue.getProjectId(), userId,
                "PRIORITY_CHANGED", actor + " changed priority of " + issue.getIssueKey() + " from " + issue.getPriority() + " to " + priority);
        issue.setPriority(priority);
        issue = issueRepo.save(issue);
        return toResponse(issue);
    }

    @Transactional
    public void delete(Long id) {
        Issue issue = getEntityById(id);
        // For delete, require ADMIN or PROJECT_MANAGER or reporter
        // We don't have userId here, so we need to get from context — for now, allow but frontend will hide
        // If called via controller without user check, we will check via header in controller
        issueRepo.delete(issue);
    }

    public void deleteWithPermission(Long id, Long userId) {
        Issue issue = getEntityById(id);
        checkEditPermission(issue, userId);
        issueRepo.delete(issue);
    }

    public List<IssueResponse> search(Long projectId, String query, String assignee, String priority, String status, String deadlineStatus, Long userId) {
        List<Issue> issues;
        if (projectId != null) {
            issues = issueRepo.findByProjectId(projectId);
        } else {
            issues = issueRepo.findAll();
        }

        return issues.stream()
                .filter(i -> {
                    if (query != null && !query.isBlank()) {
                        String q = query.toLowerCase();
                        boolean matches = i.getTitle().toLowerCase().contains(q)
                                || (i.getDescription() != null && i.getDescription().toLowerCase().contains(q))
                                || i.getIssueKey().toLowerCase().contains(q);
                        if (!matches) return false;
                    }
                    if (assignee != null && !assignee.isBlank()) {
                        if ("my".equalsIgnoreCase(assignee) || "me".equalsIgnoreCase(assignee)) {
                            if (userId == null || !userId.equals(i.getAssigneeId())) return false;
                        } else {
                            try {
                                Long aid = Long.parseLong(assignee);
                                if (!aid.equals(i.getAssigneeId())) return false;
                            } catch (NumberFormatException e) {
                            }
                        }
                    }
                    if (priority != null && !priority.isBlank()) {
                        if (!i.getPriority().name().equalsIgnoreCase(priority)) return false;
                    }
                    if (status != null && !status.isBlank()) {
                        if (!i.getStatus().equalsIgnoreCase(status)) return false;
                    }
                    if (deadlineStatus != null && !deadlineStatus.isBlank()) {
                        DeadlineStatus ds = DeadlineCalculator.calculate(i.getDueDate(), i.getStatus());
                        if (!ds.name().equalsIgnoreCase(deadlineStatus)) return false;
                    }
                    return true;
                })
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    public List<IssueResponse> getByAssignee(Long userId) {
        return issueRepo.findByAssigneeId(userId).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public List<IssueResponse> getReviewIssuesForCreator(Long creatorId, Long projectId) {
        List<Issue> all = issueRepo.findByReporterId(creatorId);
        return all.stream()
                .filter(i -> isReviewOrDoneStatus(i.getStatus()))
                .filter(i -> projectId == null || projectId.equals(i.getProjectId()))
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private boolean isReviewOrDoneStatus(String status) {
        if (status == null) return false;
        if (isReviewStatus(status)) return true;
        return "DONE".equalsIgnoreCase(status) || "COMPLETED".equalsIgnoreCase(status);
    }

    public List<IssueResponse> getSubtasks(Long parentId) {
        return issueRepo.findByParentId(parentId).stream().map(this::toResponse).collect(Collectors.toList());
    }

    public IssueResponse getParent(Long issueId) {
        Issue issue = getEntityById(issueId);
        if (issue.getParentId() == null) throw new ResourceNotFoundException("No parent");
        return getById(issue.getParentId());
    }

    private String getUserName(Long userId) {
        if (userId == null) return "Unassigned";
        return userRepo.findById(userId).map(User::getName).orElse("Unknown");
    }

    public IssueResponse toResponse(Issue issue) {
        Project project = null;
        List<String> wf = List.of("TODO","IN_PROGRESS","IN_REVIEW","DONE");
        if (issue.getProjectId() != null) {
            project = projectRepo.findById(issue.getProjectId()).orElse(null);
            if (project != null && project.getWorkflow() != null) {
                wf = parseWorkflow(project.getWorkflow());
            }
        }
        boolean isDone = isDoneStatus(issue.getStatus(), wf);
        DeadlineStatus ds;
        if (isDone) ds = DeadlineStatus.COMPLETED;
        else ds = DeadlineCalculator.calculate(issue.getDueDate(), issue.getStatus());

        String completionLabel = null;
        if (isDone && issue.getCompletedDate() != null) {
            completionLabel = DeadlineCalculator.completionLabel(issue.getDueDate(), issue.getCompletedDate());
        }

        String deadlineLabel;
        switch (ds) {
            case OVERDUE: deadlineLabel = "OVERDUE"; break;
            case DUE_TODAY: deadlineLabel = "DUE TODAY"; break;
            case COMPLETED:
                deadlineLabel = completionLabel != null ? completionLabel.toUpperCase() : "COMPLETED";
                break;
            default: deadlineLabel = "UPCOMING"; break;
        }

        String assigneeName = null;
        if (issue.getAssigneeId() != null) {
            assigneeName = userRepo.findById(issue.getAssigneeId()).map(User::getName).orElse(null);
        }
        String reporterName = null;
        if (issue.getReporterId() != null) {
            reporterName = userRepo.findById(issue.getReporterId()).map(User::getName).orElse(null);
        }
        String movedToReviewByName = null;
        if (issue.getMovedToReviewBy() != null) {
            movedToReviewByName = userRepo.findById(issue.getMovedToReviewBy()).map(User::getName).orElse(null);
        }
        String projectKey = null, projectName = null;
        if (project != null) { projectKey = project.getKey(); projectName = project.getName(); }
        long commentCount = commentRepo.countByIssueId(issue.getId());
        long subtaskCount = issueRepo.countByParentId(issue.getId());
        long linkedCount = issueLinkRepo.findBySourceIssueIdOrTargetIssueId(issue.getId(), issue.getId()).size();
        long watcherCount = watcherRepo.countByIssueId(issue.getId());
        long attachmentCount = attachmentRepo.findByIssueId(issue.getId()).size();
        String parentKey = null;
        if (issue.getParentId() != null) {
            Issue parent = issueRepo.findById(issue.getParentId()).orElse(null);
            if (parent != null) parentKey = parent.getIssueKey();
        }

        return IssueResponse.builder()
                .id(issue.getId())
                .projectId(issue.getProjectId())
                .issueKey(issue.getIssueKey())
                .title(issue.getTitle())
                .description(issue.getDescription())
                .issueType(issue.getIssueType())
                .priority(issue.getPriority())
                .status(issue.getStatus())
                .assigneeId(issue.getAssigneeId())
                .assigneeName(assigneeName)
                .reporterId(issue.getReporterId())
                .reporterName(reporterName)
                .projectKey(projectKey)
                .projectName(projectName)
                .dueDate(issue.getDueDate())
                .completedDate(issue.getCompletedDate())
                .deadlineStatus(ds)
                .completionLabel(completionLabel)
                .deadlineLabel(deadlineLabel)
                .createdAt(issue.getCreatedAt())
                .updatedAt(issue.getUpdatedAt())
                .commentCount(commentCount)
                .movedToReviewBy(issue.getMovedToReviewBy())
                .movedToReviewByName(movedToReviewByName)
                .movedToReviewAt(issue.getMovedToReviewAt())
                .labels(issue.getLabels())
                .storyPoints(issue.getStoryPoints())
                .sprint(issue.getSprint())
                .components(issue.getComponents())
                .parentId(issue.getParentId())
                .parentKey(parentKey)
                .subtaskCount(subtaskCount)
                .linkedCount(linkedCount)
                .watcherCount(watcherCount)
                .watchedByCurrentUser(false)
                .attachmentCount(attachmentCount)
                .build();
    }
}
