# jiraLite — Production-Style Jira Clone (Due Date / Deadline System)

Clean, fast, deadline-aware project management platform built as monolithic Spring Boot + Vanilla JS SPA.

### Stack
- Backend: Java 21 + Spring Boot 3.2.5 + Spring Data JPA + H2 (file) / MySQL + Lombok + Bean Validation
- Frontend: HTML5 + CSS3 + Vanilla JavaScript (ES6+ arrow functions, async/await, modules, destructuring) + Fetch API + Drag & Drop
- No React/Vue/Angular — HTML lives **only** in `.html` files (templates), JS contains **zero** HTML strings (pure DOM APIs + `<template>` cloning)

### Deadline System (Core)
- `dueDate` required on every issue (MySQL `DATE`)
- Dynamic `deadlineStatus`: `UPCOMING` / `DUE_TODAY` / `OVERDUE` / `COMPLETED` — calculated from `currentDate + dueDate + status` (never stored as primary status)
- Completed issues show `Completed on time` vs `Completed late` (compares `completedDate` vs `dueDate`)
- Board cards show deadline badge with professional colors; overdue is visually obvious (red left border + badge)
- Filters: All / My Issues / Overdue / Due Today / Upcoming / Completed
- My Tasks grouped: OVERDUE / DUE TODAY / UPCOMING / COMPLETED
- Dashboard: Overdue / Due Today / Upcoming / Completed counts + Deadline Health bar

### Quick Start
#### Backend
```bash
cd backend
mvn spring-boot:run
# runs on http://localhost:8080
# H2 file DB at ./data/jira_deadline_db.mv.db (auto-created)
# MySQL: set SPRING_PROFILES_ACTIVE=mysql and configure application-mysql.properties
```

Seed data (auto on first start):
- Users: admin@example.com/admin123, manager@example.com/manager123, developer@example.com/dev123
- 3 projects (ECOM, CRM, MOB) + 15 issues with varied deadlines

#### Frontend
```bash
cd frontend
npx http-server . -p 5500 --cors -c-1
# open http://localhost:5500
# or python -m http.server 5500
```
Login with any seed user, then follow vertical flow: Dashboard → Projects → Board → Drag TODO→IN_PROGRESS → refresh persists → comment → activity → My Tasks → Reports.

### API (selected)
- `POST /api/auth/register` / `POST /api/auth/login`
- `GET/POST /api/projects`, `GET /api/projects/{id}/members`, `POST /api/projects/{id}/members`
- `POST /api/issues` (requires `dueDate`), `GET /api/projects/{id}/issues`, `PUT /api/issues/{id}`, `PATCH /api/issues/{id}/status` `{status, userId}`, `PATCH /api/issues/{id}/assignee`, `PATCH /api/issues/{id}/priority`
- `GET/POST /api/issues/{id}/comments`
- `GET /api/issues/{id}/activity`, `GET /api/dashboard?userId=1`
- Issue response includes `dueDate`, `deadlineStatus`, `completionLabel`

### Verification Checklist
- [x] Register/Login, Projects CRUD, Members add/remove
- [x] Create issue with dueDate, appears on board, drag persists after refresh
- [x] Deadline status dynamic (tomorrow→UPCOMING, today→DUE TODAY, yesterday→OVERDUE, DONE→COMPLETED)
- [x] Comments + Activity history
- [x] Search (key/title/description) + filters (priority/type/deadline)
- [x] My Tasks deadline-grouped + Dashboard stats
- [x] Frontend HTML only in .html (templates), JS uses arrow functions & ES6+

