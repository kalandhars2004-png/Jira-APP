package com.jira.service;

import com.jira.dto.DashboardDtos.*;
import com.jira.dto.IssueDtos.IssueResponse;
import com.jira.entity.Issue;
import com.jira.enums.DeadlineStatus;
import com.jira.enums.Priority;
import com.jira.repository.*;
import com.jira.util.DeadlineCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final ProjectRepository projectRepo;
    private final IssueRepository issueRepo;
    private final ProjectMemberRepository memberRepo;
    private final ActivityService activityService;
    private final IssueService issueService;

    public DashboardResponse getDashboard(Long userId) {
        long totalProjects = projectRepo.count();
        List<Issue> allIssues = issueRepo.findAll();
        long totalIssues = allIssues.size();
        long open = allIssues.stream().filter(i -> "TODO".equalsIgnoreCase(i.getStatus())).count();
        long inProgress = allIssues.stream().filter(i -> "IN_PROGRESS".equalsIgnoreCase(i.getStatus())).count();
        long inReview = allIssues.stream().filter(i -> "IN_REVIEW".equalsIgnoreCase(i.getStatus())).count();
        long completed = allIssues.stream().filter(i -> "DONE".equalsIgnoreCase(i.getStatus()) || "APPROVED".equalsIgnoreCase(i.getStatus()) || "PUBLISHED".equalsIgnoreCase(i.getStatus())).count();
        long critical = allIssues.stream().filter(i -> i.getPriority() == Priority.CRITICAL).count();

        long overdue = allIssues.stream().filter(i -> DeadlineCalculator.calculate(i.getDueDate(), i.getStatus()) == DeadlineStatus.OVERDUE).count();
        long dueToday = allIssues.stream().filter(i -> DeadlineCalculator.calculate(i.getDueDate(), i.getStatus()) == DeadlineStatus.DUE_TODAY).count();
        long upcoming = allIssues.stream().filter(i -> DeadlineCalculator.calculate(i.getDueDate(), i.getStatus()) == DeadlineStatus.UPCOMING).count();

        List<ProjectProgress> progresses = projectRepo.findAll().stream().map(p -> {
            long total = issueRepo.countByProjectId(p.getId());
            // Generic: last workflow stage is done
            List<String> wf = parseWorkflow(p.getWorkflow());
            String doneStatus = wf.isEmpty() ? "DONE" : wf.get(wf.size()-1);
            long comp = issueRepo.countByProjectIdAndStatus(p.getId(), doneStatus);
            int prog = total == 0 ? 0 : (int) Math.round(comp * 100.0 / total);
            return ProjectProgress.builder()
                    .projectId(p.getId())
                    .projectKey(p.getKey())
                    .projectName(p.getName())
                    .total(total)
                    .completed(comp)
                    .progress(prog)
                    .build();
        }).collect(Collectors.toList());

        // status distribution — generic by string
        Map<String, Long> statusMap = allIssues.stream().collect(Collectors.groupingBy(i -> i.getStatus() != null ? i.getStatus().toUpperCase() : "TODO", Collectors.counting()));
        // Show default + any custom statuses found
        Set<String> allStatuses = new LinkedHashSet<>();
        allStatuses.addAll(List.of("TODO","IN_PROGRESS","IN_REVIEW","DONE"));
        allStatuses.addAll(statusMap.keySet());
        List<StatusDistribution> statusDist = allStatuses.stream().map(s -> {
            long c = statusMap.getOrDefault(s, 0L);
            int pct = totalIssues == 0 ? 0 : (int) Math.round(c * 100.0 / totalIssues);
            return StatusDistribution.builder().status(s).count(c).percentage(pct).build();
        }).collect(Collectors.toList());

        Map<Priority, Long> priMap = allIssues.stream().collect(Collectors.groupingBy(Issue::getPriority, Collectors.counting()));
        List<PriorityDistribution> priDist = Arrays.stream(Priority.values()).map(p -> {
            long c = priMap.getOrDefault(p, 0L);
            return PriorityDistribution.builder().priority(p.name()).count(c).build();
        }).collect(Collectors.toList());

        List<IssueResponse> myIssues = Collections.emptyList();
        if (userId != null) {
            myIssues = issueService.getByAssignee(userId);
        }

        return DashboardResponse.builder()
                .totalProjects(totalProjects)
                .totalIssues(totalIssues)
                .openIssues(open)
                .inProgress(inProgress)
                .inReview(inReview)
                .completed(completed)
                .criticalIssues(critical)
                .overdue(overdue)
                .dueToday(dueToday)
                .upcoming(upcoming)
                .projectProgress(progresses)
                .recentActivity(activityService.getRecent(10))
                .myIssues(myIssues)
                .statusDistribution(statusDist)
                .priorityDistribution(priDist)
                .build();
    }

    private List<String> parseWorkflow(String json) {
        if (json == null || json.isBlank()) return List.of("TODO","IN_PROGRESS","IN_REVIEW","DONE");
        try {
            String t = json.trim();
            if (t.startsWith("[")) t = t.substring(1);
            if (t.endsWith("]")) t = t.substring(0, t.length()-1);
            if (t.isBlank()) return List.of("TODO","IN_PROGRESS","IN_REVIEW","DONE");
            return Arrays.stream(t.split(",")).map(s -> s.trim().replaceAll("^\"|\"$", "")).filter(s -> !s.isBlank()).collect(Collectors.toList());
        } catch (Exception e) {
            return List.of("TODO","IN_PROGRESS","IN_REVIEW","DONE");
        }
    }
}
