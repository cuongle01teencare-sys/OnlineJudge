# REST API

Base URL: `${NEXT_PUBLIC_API_URL}` (dev: `http://localhost:4000/api`).
All request/response types live in `@oj/contracts` (`src/shared/src/api.ts`).

Auth: `Authorization: Bearer <accessToken>` (JWT; payload `{ sub, role, name }`).
Errors: JSON `ApiErrorBody` `{ statusCode, message, code? }`. `message` is human readable (Vietnamese).

Roles: `ADMIN` (exactly one, seeded from env), `TEACHER` (invited by admin by email), `STUDENT` (self-registered with a class's join code + email OTP).
"Staff" = ADMIN or TEACHER.

## Auth / users
| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| POST | /auth/login | public | LoginRequest | AuthResponse |
| GET | /auth/me | any | – | UserDto |
| POST | /auth/register | public | RegisterRequest (`classCode` optional) | 202 VerificationTicketDto — a 6-digit OTP is emailed; no account yet. With a class code, a JOIN request to that class is created once verified (the teacher approves); without one the student is a free candidate |
| POST | /auth/register/verify | public | VerifyCodeRequest | AuthResponse (account created, role STUDENT) |
| POST | /auth/verification/resend | public | ResendCodeRequest | VerificationTicketDto (409 if before `resendAvailableAt`) |
| POST | /auth/password/forgot | public | ForgotPasswordRequest | 202 VerificationTicketDto (same answer whether the email exists or not) |
| POST | /auth/password/reset | public | ResetPasswordRequest | AuthResponse (signed in with the new password) |
| GET | /auth/invitations/:id | public | – | InvitationPreviewDto (400 if expired/used) |
| POST | /auth/invitations/accept | public | AcceptInvitationRequest | AuthResponse (account created, role TEACHER) |
| GET | /users | ADMIN | – | UserDto[] |
| DELETE | /users/:id | ADMIN | – | 204 (cannot delete admin) |
| GET | /users/invitations | ADMIN | – | InvitationDto[] (pending teacher invitations) |
| POST | /users/invitations | ADMIN | InviteTeacherRequest | InvitationDto — email with link `${FRONTEND_URL}/invite?id=<id>&code=<code>` |
| POST | /users/invitations/:id/resend | ADMIN | – | InvitationDto (new code, old link stops working; 1-minute cooldown) |
| DELETE | /users/invitations/:id | ADMIN | – | 204 |

OTP rules: 6 digits, valid 10 minutes (invitations: 7 days), 5 wrong attempts then "send again", resend cooldown 60s.
Phone is optional, Vietnamese format, stored for contact only (not verified).

## Concepts (since "Đợt 1")

- **Bank (ngân hàng)**: problems and problem sets are *blueprints* owned by a teacher (or the admin).
  Nobody submits to a blueprint. The admin may view and edit every bank.
- **Sharing**: a blueprint is private by default. A problem can be made public at three independent
  levels: statement (`isPublic`), hidden tests (`publicTests`), solution (`publicSolution`). Other teachers
  can view public blueprints and **copy** them into their own bank (the copy records `copiedFrom`).
- **Session (phiên)**: an *instance* of a set blueprint (or of a single problem) given either to a class
  or to everyone (public). Problems are **frozen** (snapshot) when the session is created, so editing the bank
  never changes a running session. Each session has an optional open/close time. Submissions, scores and
  "solved" status belong to a session: solving problem P in session A does not count for session B.
- **Solved**: a problem is solved in a session when the student has an AC submission in that session.
  A session is completed when every problem in it is solved.
- **Class lifecycle**: ACTIVE → ARCHIVED (course finished: read-only, no new students, no submissions;
  students can still open the sessions) → can be restored, or deleted for good (scheduled after N days,
  or immediately with name confirmation). Deleting removes the class and its sessions; students keep their
  learning record (titles and results, no access to statements) and their own submitted code.
- A student may be in **several classes** at once, or in none (free candidate: public sessions and practice only).
  Students only *ask* to join (by class code) or to leave; the class manager approves or rejects. Managers act
  directly: add a student by email, remove a student. Classes a student left or that were archived remain as history.

## Classes (lớp)
"Manager" of a class = its teacher or the admin.

| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /classes | any | – | ClassroomDto[] — admin: all; teacher: classes they teach; student: current classes + history (`code` null, `isCurrent`); managers also get `pendingRequestCount` |
| POST | /classes | staff | UpsertClassroomRequest | ClassroomDto. Teachers always create for themselves; admin may pass `teacherId` |
| GET | /classes/:id | manager or (former) member | – | ClassroomDto |
| PUT | /classes/:id | manager | UpsertClassroomRequest | ClassroomDto (changing `teacherId`: admin only; not allowed while archived) |
| POST | /classes/:id/archive | manager | – | ClassroomDto (status ARCHIVED) |
| POST | /classes/:id/restore | manager | – | ClassroomDto (ACTIVE again, cancels scheduled deletion) |
| POST | /classes/:id/schedule-deletion | manager | ScheduleClassDeletionRequest | ClassroomDto (`purgeAt` set; class must be archived) |
| POST | /classes/:id/cancel-deletion | manager | – | ClassroomDto |
| POST | /classes/:id/delete-now | manager | DeleteClassNowRequest | 204 (class must be archived; `confirmName` must equal the name) |
| GET | /classes/:id/students | manager | – | ClassStudentDto[] (current students) |
| POST | /classes/:id/students | manager | AddStudentRequest | ClassStudentDto — adds a registered student by email (404 if no such student account); settles their pending requests for the class |
| DELETE | /classes/:id/students/:studentId | manager | – | 204 — removes the student; the class stays in their history |
| GET | /classes/unassigned-students | ADMIN | – | ClassStudentDto[] (students with no current class) |
| PUT | /classes/students/:studentId | manager of the target class | MoveStudentRequest | ClassStudentDto — adds the student to that ACTIVE class; other classes are not affected |

### Join and leave requests
| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| POST | /classes/join | STUDENT | JoinClassRequest | 201 MembershipRequestDto (PENDING). 400 wrong code or archived class; 409 already a member or already pending |
| POST | /classes/:id/leave | STUDENT (current member) | LeaveClassRequest | 201 MembershipRequestDto (PENDING). 409 already pending or class archived |
| GET | /membership-requests/mine | STUDENT | – | MembershipRequestDto[] — last 30, newest first, every status |
| POST | /membership-requests/:id/cancel | STUDENT (sender) | – | MembershipRequestDto (CANCELLED) |
| GET | /classes/:id/requests | manager | – | MembershipRequestDto[] — pending JOIN and LEAVE requests, oldest first |
| POST | /membership-requests/:id/approve | manager | – | MembershipRequestDto (APPROVED; JOIN opens the membership, LEAVE ends it). Class must be ACTIVE |
| POST | /membership-requests/:id/reject | manager | – | MembershipRequestDto (REJECTED) |
| POST | /classes/:id/requests/approve-all | manager | – | `{ approved: number }` — approves every pending JOIN request |

A decided request cannot be decided again (409). Requests are deleted with their class or the student account.

Class codes: 4–20 chars `A-Z 0-9 -`, case-insensitive, unique (e.g. `22DTHC5`). Only ACTIVE classes accept join requests.
Deleting a teacher account hands their classes to the admin.

## Problem bank (catalog)
Staff only (students reach problems through sessions).

| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /problems?scope=mine\|public\|all&search=&difficulty=&tag=&page=1&pageSize=20 | staff (`all`: admin) | – | Paginated<ProblemSummaryDto> |
| GET | /problems/:id | owner, admin, or any staff if public | – | ProblemDetailDto (tests/solution filtered by sharing) |
| POST | /problems | staff | UpsertProblemRequest | ProblemDetailDto (owned by the caller) |
| PUT | /problems/:id | owner or admin | UpsertProblemRequest | ProblemDetailDto |
| DELETE | /problems/:id | owner or admin | – | 204 (removed from the owner's sets; running sessions keep their frozen copy) |
| PUT | /problems/:id/sharing | owner or admin | SharingDto | ProblemDetailDto |
| POST | /problems/:id/copy | staff, problem public (or admin) | – | ProblemDetailDto — copy in the caller's bank (hidden tests / solution only if shared) |
| POST | /problems/:id/test-cases | owner or admin | UpsertTestCaseRequest | TestCaseDto |
| POST | /problems/:id/test-cases/suggest | owner or admin | SuggestTestCasesRequest (`count` 1–10, default 5; optional `focus`) | 200 TestCaseSuggestionsDto — AI-proposed tests, **not saved**; the editor adds the ones they keep with POST /problems/:id/test-cases. Claude computes outputs by running code (`outputVerified`). Inputs the problem already has are dropped. 400 `catalog.ai_unavailable` without ANTHROPIC_API_KEY, `catalog.ai_failed` when the AI call fails. Takes 30 s – 2 min |
| PUT | /problems/:id/test-cases/:testCaseId | owner or admin | UpsertTestCaseRequest | TestCaseDto |
| DELETE | /problems/:id/test-cases/:testCaseId | owner or admin | – | 204 |
| PUT | /problems/:id/solution | owner or admin | UpsertSolutionRequest | SolutionDto |
| DELETE | /problems/:id/solution | owner or admin | – | 204 |

`code` of a problem is auto-generated (`P0001`, ...).

## Importing exam documents (into the caller's bank)
| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| POST | /imports/parse | staff | multipart/form-data, field `file` (.docx or .pdf, ≤ 10MB) | ParsedExamDto |
| POST | /imports/confirm | staff | ImportProblemsRequest | ImportProblemsResponse (problems owned by the caller) |

## Problem set bank
| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /problem-sets?scope=mine\|public\|all | staff (`all`: admin) | – | ProblemSetDto[] |
| GET | /problem-sets/:id | owner, admin, or staff if public | – | ProblemSetDto |
| POST | /problem-sets | staff | UpsertProblemSetRequest (items from own bank) | ProblemSetDto |
| PUT | /problem-sets/:id | owner or admin | UpsertProblemSetRequest | ProblemSetDto |
| DELETE | /problem-sets/:id | owner or admin | – | 204 (sessions created from it are kept) |
| PUT | /problem-sets/:id/sharing | owner or admin | ProblemSetSharingRequest | ProblemSetDto (public requires all its problems public) |
| POST | /problem-sets/:id/copy | staff, set public (or admin) | – | ProblemSetDto — copies the set and its problems into the caller's bank |
| GET | /problem-sets/:id/answer-key | owner or admin | – | AnswerKeyDto (for printing the paper / answer key) |

## Sessions (phiên)
"Manager" of a session = teacher of its class (class sessions), its creator (public sessions), or the admin.

| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /sessions?classId=&audience=CLASS\|PUBLIC | any | – | SessionDto[] — students: sessions of their current/former classes + public; teachers: their classes + public; admin: all |
| GET | /sessions/:id | manager, class (former) member, anyone for public | – | SessionDto (with `myProgress`) |
| GET | /sessions/:id/problems/:key | same as above | – | SessionProblemDto |
| POST | /sessions | staff | CreateSessionRequest | SessionDto — source must be in the caller's bank (admin: any); class must be managed and ACTIVE |
| PUT | /sessions/:id | manager | UpdateSessionRequest | SessionDto |
| DELETE | /sessions/:id | manager | – | 204 (also removes its submissions and progress) |
| GET | /sessions/:id/results | manager | – | SessionResultsDto — class: every current student (zeros included) plus anyone who submitted; public: participants |

Submitting is allowed when: the session is OPEN (now within opensAt/closesAt), and for class sessions the class is
ACTIVE and the user is a current student of it or its manager. Public sessions: any signed-in user.

### Exam mode and session settings (Đợt 2)
`CreateSessionRequest.settings` / `UpdateSessionRequest.settings` (`SessionSettingsDto`):
- `durationMinutes`: timed session. Each participant presses **start** (`POST /sessions/:id/start`) and gets
  `min(start + duration, closesAt)` (`SessionDto.myAttempt.endsAt`). Before starting, `needsStart` is true and
  problem statements return 403; after `endsAt` submissions are refused. Managers are never timed.
- `allowedLanguages` (empty = all), `maxSubmissionsPerProblem` (per participant and problem; null = unlimited).
- `feedback`: `FULL` | `SCORE_ONLY` (verdict + score, no per-test results) | `HIDDEN_UNTIL_CLOSED` (only "submitted").
  Applies to participants until the session closes; managers always see everything. Hidden results show as
  `SubmissionDto.resultsHidden` / `testsHidden`, `MySessionProgressDto.resultsHidden` and học bạ `resultsHidden`.
- `SessionDto.serverNow` lets clients correct their countdown for clock skew.

| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| POST | /sessions/:id/start | participant | – | SessionDto (idempotent; timer starts once) |
| POST | /sessions/:id/refresh | manager | – | SessionDto — re-freezes problems from their current bank version (keys/points kept). Follow with a rejudge |
| POST | /sessions/:id/rejudge | manager | RejudgeRequest | RejudgeResponse — every submission (or of one problem) is judged again with the session's current tests; scores and học bạ are rebuilt from the new results |

## Submissions (judging)
| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| POST | /submissions | see above | SubmitRequest | SubmissionDto (status PENDING) |
| GET | /submissions?sessionId=&problemKey=&mine=true&page=1&pageSize=20 | any | – | Paginated<SubmissionDto> — students: own only; staff: own, or all of a session they manage (`sessionId` required unless admin) |
| GET | /submissions/:id | owner, session manager, admin | – | SubmissionDetailDto |

Clients poll `GET /submissions/:id` (≈1s) until `status === 'DONE'`.

## Learning record (học bạ)
| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /progress/me | any | – | LearningRecordDto — grouped by class (current, archived, deleted) and public practice |

## Đợt 3: AI exam reader, integrity checks, class community

### Importing with AI
`POST /imports/parse` uses Claude when the server has `ANTHROPIC_API_KEY` (PDF is sent as a document, so messy layouts and
scanned pages work; DOCX is sent as extracted text with tables). If there is no key or the AI call fails, the rule-based
reader is used. `ParsedExamDto.parser` says which one produced the drafts (`AI` | `BASIC`).

### Integrity checks (teacher-only "gợi ý cần xem lại")
Two independent switches in `SessionSettingsDto`: `checkPlagiarism`, `checkAiUsage`. After a submission is judged
(not CE/IE), the server checks it in the background:
- plagiarism: code fingerprints (tokens normalised, identifiers ignored) compared with every other participant's
  submissions of the same problem in the same session; flagged at similarity ≥ 0.75 (≥ 0.9 = HIGH);
- AI usage: Claude reviews statement + code and returns a risk with reasons and line ranges; MEDIUM/HIGH are flagged.
Flags are never shown to students and never change scores.

| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /integrity-flags?status=OPEN\|ACKNOWLEDGED&sessionId= | staff | – | IntegrityFlagDto[] — flags of sessions the caller manages |
| GET | /integrity-flags/:id | session manager | – | IntegrityFlagDetailDto (both codes for side-by-side comparison) |
| POST | /integrity-flags/:id/acknowledge | session manager | – | IntegrityFlagDto (status ACKNOWLEDGED, "Đã xem") |

### Class community
| Method | Path | Who | Body | Response |
|---|---|---|---|---|
| GET | /classes/:id/threads?sessionId=&problemKey= | class teacher/admin, current or former students | – | ThreadSummaryDto[] (pinned first, then latest activity) |
| POST | /classes/:id/threads | ANNOUNCEMENT: manager; QUESTION: current students and manager | CreateThreadRequest | ThreadDto |
| GET | /threads/:id | as above | – | ThreadDto |
| POST | /threads/:id/replies | current students and manager | CreateReplyRequest | ThreadReplyDto |
| DELETE | /threads/:id | author or manager | – | 204 |
| DELETE | /threads/:id/replies/:replyId | author or manager | – | 204 |
| POST | /threads/:id/pin | manager | PinThreadRequest | ThreadDto |

Archived classes are read-only (no new threads or replies); threads are deleted with the class.
