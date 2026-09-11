package com.jira.config;

import com.jira.entity.*;
import com.jira.enums.*;
import com.jira.repository.*;
import com.jira.service.ActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import java.time.LocalDate;

@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepo;
    private final ProjectRepository projectRepo;
    private final ProjectMemberRepository memberRepo;
    private final IssueRepository issueRepo;
    private final CommentRepository commentRepo;
    private final ActivityService activityService;

    @Override
    public void run(String... args) throws Exception {
        if (userRepo.count() > 0) return; // avoid duplicate

        System.out.println("=== Seeding initial data ===");

        // Users
        User admin = userRepo.save(User.builder().name("Kalandhar").email("admin@example.com").password("admin123").role(UserRole.ADMIN).build());
        User manager = userRepo.save(User.builder().name("Arun").email("manager@example.com").password("manager123").role(UserRole.PROJECT_MANAGER).build());
        User dev = userRepo.save(User.builder().name("John Doe").email("developer@example.com").password("dev123").role(UserRole.MEMBER).build());
        User tester = userRepo.save(User.builder().name("Sarah Lee").email("sarah@example.com").password("sarah123").role(UserRole.MEMBER).build());
        User designer = userRepo.save(User.builder().name("Priya").email("priya@example.com").password("priya123").role(UserRole.MEMBER).build());

        // Projects — generic workflows
        Project ecom = projectRepo.save(Project.builder().name("E-Commerce Platform").key("ECOM").description("Modern e-commerce platform with payment gateway, inventory and order management.").createdBy(admin.getId()).issueCounter(0).status(ProjectStatus.ACTIVE).workflow("[\"TODO\",\"IN_PROGRESS\",\"IN_REVIEW\",\"DONE\"]").teamType("Software Team").build());
        Project crm = projectRepo.save(Project.builder().name("Customer Management").key("CRM").description("CRM system for tracking customers, leads and support tickets.").createdBy(manager.getId()).issueCounter(0).status(ProjectStatus.ACTIVE).workflow("[\"BACKLOG\",\"TODO\",\"IN_PROGRESS\",\"REVIEW\",\"DONE\"]").teamType("Product Team").build());
        Project mobile = projectRepo.save(Project.builder().name("Mobile App Redesign").key("MOB").description("Complete redesign of mobile application with new design system.").createdBy(admin.getId()).issueCounter(0).status(ProjectStatus.ACTIVE).workflow("[\"TODO\",\"IN_PROGRESS\",\"DONE\"]").teamType("Product Team").build());

        // Members
        memberRepo.save(ProjectMember.builder().projectId(ecom.getId()).userId(admin.getId()).role(ProjectRole.PROJECT_MANAGER).build());
        memberRepo.save(ProjectMember.builder().projectId(ecom.getId()).userId(manager.getId()).role(ProjectRole.DEVELOPER).build());
        memberRepo.save(ProjectMember.builder().projectId(ecom.getId()).userId(dev.getId()).role(ProjectRole.DEVELOPER).build());
        memberRepo.save(ProjectMember.builder().projectId(ecom.getId()).userId(tester.getId()).role(ProjectRole.TESTER).build());
        memberRepo.save(ProjectMember.builder().projectId(ecom.getId()).userId(designer.getId()).role(ProjectRole.MEMBER).build());
        memberRepo.save(ProjectMember.builder().projectId(crm.getId()).userId(manager.getId()).role(ProjectRole.PROJECT_MANAGER).build());
        memberRepo.save(ProjectMember.builder().projectId(crm.getId()).userId(dev.getId()).role(ProjectRole.DEVELOPER).build());
        memberRepo.save(ProjectMember.builder().projectId(crm.getId()).userId(tester.getId()).role(ProjectRole.TESTER).build());
        memberRepo.save(ProjectMember.builder().projectId(mobile.getId()).userId(admin.getId()).role(ProjectRole.PROJECT_MANAGER).build());
        memberRepo.save(ProjectMember.builder().projectId(mobile.getId()).userId(designer.getId()).role(ProjectRole.DEVELOPER).build());
        memberRepo.save(ProjectMember.builder().projectId(mobile.getId()).userId(dev.getId()).role(ProjectRole.DEVELOPER).build());

        LocalDate today = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);
        LocalDate tomorrow = today.plusDays(1);
        LocalDate in3days = today.plusDays(3);
        LocalDate in7days = today.plusDays(7);
        LocalDate twoDaysAgo = today.minusDays(2);
        LocalDate fiveDaysAgo = today.minusDays(5);

        // ECOM Issues
        createIssue(ecom, "Fix Payment API", "Payment API returns 500 when coupon is applied. Need to handle edge case.", IssueType.BUG, Priority.HIGH, "IN_PROGRESS", manager.getId(), admin.getId(), yesterday, 1);
        createIssue(ecom, "Add search functionality", "Implement global search for products with filters", IssueType.STORY, Priority.MEDIUM, "TODO", dev.getId(), admin.getId(), in3days, 2);
        createIssue(ecom, "Fix login validation", "Login form does not validate email format properly", IssueType.BUG, Priority.CRITICAL, "IN_PROGRESS", tester.getId(), manager.getId(), today, 3);
        createIssue(ecom, "Update product carousel", "Product carousel not responsive on mobile devices", IssueType.IMPROVEMENT, Priority.LOW, "IN_REVIEW", designer.getId(), admin.getId(), tomorrow, 4);
        createIssue(ecom, "Setup CI/CD pipeline", "Configure Jenkins pipeline for automated deployment", IssueType.TASK, Priority.HIGH, "TODO", dev.getId(), admin.getId(), in7days, 5);
        Issue completedOnTime = createIssue(ecom, "Design checkout flow", "Create wireframes for new checkout experience", IssueType.STORY, Priority.MEDIUM, "DONE", designer.getId(), admin.getId(), in3days, 6);
        completedOnTime.setCompletedDate(today);
        issueRepo.save(completedOnTime);
        activityService.log(completedOnTime.getId(), ecom.getId(), designer.getId(), "COMPLETED_ON_TIME", "ECOM-6 was completed on time");
        Issue completedLate = createIssue(ecom, "Fix inventory sync", "Inventory not syncing between warehouse and store", IssueType.BUG, Priority.HIGH, "DONE", dev.getId(), manager.getId(), fiveDaysAgo, 7);
        completedLate.setCompletedDate(today);
        issueRepo.save(completedLate);
        activityService.log(completedLate.getId(), ecom.getId(), dev.getId(), "COMPLETED_LATE", "ECOM-7 was completed late");
        createIssue(ecom, "Add wishlist feature", "Allow users to save products to wishlist", IssueType.STORY, Priority.MEDIUM, "TODO", dev.getId(), admin.getId(), yesterday, 8);
        // CRM Issues
        createIssue(crm, "Create customer import", "Bulk import customers from CSV file", IssueType.TASK, Priority.MEDIUM, "TODO", dev.getId(), manager.getId(), today, 1);
        createIssue(crm, "Fix email notification", "Email not sent after customer creation", IssueType.BUG, Priority.CRITICAL, "IN_PROGRESS", tester.getId(), manager.getId(), tomorrow, 2);
        createIssue(crm, "Add lead scoring", "Implement lead scoring algorithm", IssueType.IMPROVEMENT, Priority.HIGH, "TODO", dev.getId(), manager.getId(), in7days, 3);
        createIssue(crm, "Dashboard analytics", "Add charts for customer analytics dashboard", IssueType.STORY, Priority.MEDIUM, "IN_REVIEW", dev.getId(), manager.getId(), twoDaysAgo, 4);
        // MOB Issues
        createIssue(mobile, "Redesign onboarding", "New onboarding flow with illustrations", IssueType.STORY, Priority.HIGH, "TODO", designer.getId(), admin.getId(), tomorrow, 1);
        createIssue(mobile, "Fix crash on launch", "App crashes on Android 12 when opening notifications", IssueType.BUG, Priority.CRITICAL, "IN_PROGRESS", dev.getId(), admin.getId(), today, 2);
        createIssue(mobile, "Add dark mode", "Implement dark mode across all screens", IssueType.IMPROVEMENT, Priority.MEDIUM, "TODO", designer.getId(), admin.getId(), in3days, 3);

        ecom.setIssueCounter(8); projectRepo.save(ecom);
        crm.setIssueCounter(4); projectRepo.save(crm);
        mobile.setIssueCounter(3); projectRepo.save(mobile);

        Issue first = issueRepo.findAll().stream().filter(i -> i.getIssueKey().equals("ECOM-1")).findFirst().orElse(null);
        if (first != null) {
            commentRepo.save(Comment.builder().issueId(first.getId()).userId(manager.getId()).content("Payment API returns 500 when coupon is applied. Checking logs now.").build());
            commentRepo.save(Comment.builder().issueId(first.getId()).userId(dev.getId()).content("Found the issue - coupon validation not handling expired coupons. Fixing it.").build());
            activityService.log(first.getId(), ecom.getId(), manager.getId(), "COMMENTED", "Arun commented on ECOM-1");
        }

        System.out.println("=== Seed completed: 5 users, 3 projects, 15 issues ===");
    }

    private Issue createIssue(Project project, String title, String desc, IssueType type, Priority pri, String status, Long assignee, Long reporter, LocalDate dueDate, int counter) {
        String key = project.getKey() + "-" + counter;
        if (project.getIssueCounter() == null || project.getIssueCounter() < counter) {
            project.setIssueCounter(counter);
        }
        Issue issue = Issue.builder()
                .projectId(project.getId())
                .issueKey(key)
                .title(title)
                .description(desc)
                .issueType(type)
                .priority(pri)
                .status(status)
                .assigneeId(assignee)
                .reporterId(reporter)
                .dueDate(dueDate)
                .build();
        if ("DONE".equalsIgnoreCase(status)) {
            issue.setCompletedDate(LocalDate.now());
        }
        issue = issueRepo.save(issue);
        User reporterUser = userRepo.findById(reporter).orElse(null);
        String reporterName = reporterUser != null ? reporterUser.getName() : "System";
        activityService.log(issue.getId(), project.getId(), reporter, "CREATED", reporterName + " created " + key);
        if (assignee != null) {
            User assigneeUser = userRepo.findById(assignee).orElse(null);
            String assigneeName = assigneeUser != null ? assigneeUser.getName() : "Unknown";
            activityService.log(issue.getId(), project.getId(), reporter, "ASSIGNED", reporterName + " assigned " + key + " to " + assigneeName);
        }
        if (!"DONE".equalsIgnoreCase(status) && dueDate.isBefore(LocalDate.now())) {
            activityService.log(issue.getId(), project.getId(), null, "BECAME_OVERDUE", key + " became overdue.");
        }
        return issue;
    }
}
