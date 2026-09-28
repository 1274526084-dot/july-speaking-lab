# Learning archive API

Additive Tencent CloudBase function for project `lzrtc-public-english-2026`.
It does not update or delete existing learning profiles, word recordings,
speaking recordings, teacher accounts, or teacher sessions.

## Deployment

Deploy this directory as the `learningArchiveApi` Node.js function with
`@cloudbase/node-sdk` 3.18.3 installed and a POST/OPTIONS HTTP service path.
Use the same China CloudBase environment as the existing speaking API.
Keep the legacy functions and routes intact. Allow enough runtime for paginated
archive reads (60 seconds is appropriate for the current function design).

The function creates only these new collections:

- `english_archive_students`
- `english_archive_access_requests`
- `english_archive_sessions`
- `english_archive_reflections`
- `english_archive_tasks`
- `english_archive_news`
- `english_archive_quiz_submissions`
- `english_archive_rates`

Set client database permissions for all eight collections to **no direct client
reads or writes**. All access goes through this server function. The existing
server SDK identity needs read access to `speaking_sessions`,
`english_learning_profiles`, `word_attempts`, and `speaking_attempts`, and write
access only to the new collections. Storage access is only for generating
temporary URLs for audio IDs in an authorized student's selected records.

The installed database SDK's `createCollection` sends only `collectionName` to
`database.addCollection`; it does not set or confirm access rules. Official
[basic-permission documentation](https://docs.cloudbase.net/database/data-permission)
defines the no-client-permission option, and the
[security-rule guide](https://docs.cloudbase.net/rule/rule-example) documents
default-deny rules. A successful create call is not proof of the live
collection's configuration: explicitly set and read back all eight rules.

The allowed browser origins are the existing GitHub Pages host,
`http://localhost:4173`, `http://localhost:5173`, `http://localhost:5179`,
and the latter two ports on `127.0.0.1`.

## Request and response format

Send JSON `{ "action": "...", ... }`. Successful replies are JSON
`{ "ok": true, "projectId": "lzrtc-public-english-2026", ... }`.
Errors use their matching HTTP status and `{ "ok": false, "error": "..." }`.
The HTTP request limit is 160 KB after decoding. Tokens must never be logged.

Teacher requests use `token`, obtained from the existing `speakingLabApi` login.
The archive verifies its hashed `speaking_sessions` record, auth version 2,
expiry, revocation, and teacher code (`cherie`, `lisa`, `alice`, or `july`).
Student requests use a separate `studentToken`.

| Action | Input besides action | Main result |
| --- | --- | --- |
| `publicFeed` | none | Published `tasks`, `news`; no quiz answers/explanations |
| `requestAccess` | `name`, `className` | `requestId`, `requestToken`, `verificationCode`, `expiresAt`, `status: pending` |
| `accessStatus` | `requestToken` | `pending`, `approved`, `rejected`, `expired`, or `revoked`; approved includes `studentToken`, `student`, `expiresAt` |
| `studentDashboard` | `studentToken` | Own dashboard described below |
| `saveReflection` | `studentToken`, seven `skills` scores, `goals` string | Appended immutable `snapshot` |
| `submitQuiz` | `studentToken`, `taskId`, `taskVersion`, `answers`, `requestId` | Immutable `submission`, `score`, `feedback` |
| `studentLogout` | `studentToken` | Revokes this device |
| `teacherSession` | `token` | Teacher `code`, `name` |
| `teacherDashboard` | `token` | `students`, all `tasks`, all `news`, `requests`, `profileRestricted` |
| `teacherStudent` | `token`, `studentId` | Authorized student's dashboard and `devices` |
| `listAccessRequests` | `token` | `requests` without request tokens or verification codes |
| `approveAccess` | `token`, `requestId`, `verificationCode`, `identityVerified: true`; optional `studentId`, `name`, `className` | Bound `student` and device `expiresAt` |
| `rejectAccess` | `token`, `requestId` | Marks pending request rejected |
| `revokeDevice` | `token`, `sessionId` | Revokes selected device |
| `saveTask` | `token`, `task` | Saved `task` |
| `saveNews` | `token`, `news` | Saved `news` |

## Identity approval

Display an explicit warning and acknowledgement before calling `approveAccess`:
the teacher must verify the student in person, corroborate the full class and
name, and read the six-digit code from that student's device. Sending a name
and class alone never grants access. Teachers do not receive the code from the
request list. A teacher can select an existing student, but the selected name
and resolved class must match the identity being approved. Ambiguous class
names require a teacher-supplied full class.

The request secret has 256 bits of randomness. Only its hash and the hash of
the verification code are stored. Pending requests expire after 24 hours.
Approval creates one 30-day device session in the same transaction as the
student binding and approved request. Polls return the same device token;
they never create new sessions. Approved handoff is available for 24 hours,
after which the already-issued device token remains usable until expiry or
revocation. Revoking a device also prevents the old request from handing out
its token again. All new records carry the explicit project ID.

Legacy identities are projected with compiled copies of `lib/class-groups.ts`
and `lib/class-catalog.ts`; source records are not changed. Project-tagged
records from another project are excluded. Untagged records must match the
existing domestic module shapes and cannot contain a Malaysian region marker.
Names alone never join records across classes. Where old class labels lack a
year, they remain separate if there is evidence of more than one possible
cohort. Same-name students within one identical class cannot be distinguished
by legacy data that never recorded another identifier; teachers must not
approve a shared identity if that collision is known.
If speaking records for the same resolved class and name contain different
student-entered student numbers (`student_id`, the original 学号 input), the
archive marks `identityConflict: true`, blocks approval, and suspends existing
student access and new submissions with a clear 409 response. Teachers may
still inspect the records and student numbers. It does not select one number,
rewrite legacy records, or invent a way to distinguish records without IDs.

Only July may view existing survey details in teacher views. Other teachers
receive `profile: null`, `profileRestricted: true`, and no legacy profile
entries in history. Approved students can view their own survey. New self-check
snapshots are shared teacher-visible archive records.

## Dashboard shape

`student` is `{ id, name, className }`.
`profile` is `null` or the legacy survey's explicitly projected fields, including
`skills`, `learning_goals`, and original snake_case field names.
`history` contains `{ id, type, title, submittedAt, score, details, audio }`.
Types are `word`, `speaking`, `quiz`, and `profile`. Scores are numbers or null.
Audio clips are `{ url, label }`; URLs expire after 300 seconds and raw storage
IDs and submission credentials are never returned.
Quiz history entries also include top-level `taskId` for completion indicators
and `details.taskVersion` for the version actually graded.
`snapshots` contains `{ id, createdAt, skills, goals }`.
`summary` contains `historyCount`, `wordCount`, `speakingCount`, `quizCount`,
`wordAverage`, `speakingAverage`, `quizAverage`, `lastActive`, `reflectionCount`.

`teacherStudent.devices` contains
`{ id, createdAt, expiresAt, revokedAt, approvedBy, active }`.
Use its `id` as `revokeDevice.sessionId`.

Collections are read in deterministic pages of up to 1,000, with at most four
pages in flight per collection, up to 10,000 records each. A parallel count
checks that the first page is truly complete. If the service applies a smaller
page ceiling, the reader continues using that observed size. It verifies an
overflow page after a multi-page scan and flags inconsistent or capped reads.
Responses explicitly flag truncation with `hasMore` and dashboard `warnings`.
Approval is blocked when the underlying identity evidence is incomplete.
Existing student reads and writes are also blocked if identity collections
hit this cap, because a truncated scan cannot reliably exclude a namesake.

All distinct class-name/major pairs contribute to identity resolution. Each
record is indexed once by resolved class and normalized name; teacher summaries
use those buckets without repeatedly scanning every student's records or
parsing audio details. Student and teacher detail views reuse the same buckets.
Only authenticated `teacherDashboard` returns non-personal diagnostic fields:
`returnedRecordCounts` (in-scope rows), `scannedRecordCounts` (all fetched rows),
`collectionTotals` (database counts), `scanPages`, and `timingsMs`. Its server
timing log contains only these counts/timings, never names, tokens, or raw rows.

## Content and immutable results

Task fields: `id?`, `title`, `unit`, `lesson`, `type`, `description`, `href`,
`classes`, `dueAt`, `status`, `questions?`, `material?`.
Types are `word`, `speaking`, `reading`, `listening`, `writing`, `quiz`, `link`.
Status is `draft` or `published`; an empty class list means all approved pupils.
Each quiz has 1–30 questions, each with `id`, `prompt`, exactly four `options`,
zero-based integer `answer`, and `explanation`.

News fields: `id?`, `title`, `summary`, `url`, `source`, `publishedDate`,
`vocabulary: [{ word, meaning }]`, `question`, `status`.
News is published only through a teacher's explicit save. To copy/import a
task or seed news item, omit `id`; supplying an ID means updating an existing
archive record. Every teacher can read shared content. Only its creator or
July can update it. There are no delete actions.

Reflections require all seven integer scores (1–5): `listening`, `speaking`,
`reading`, `writing`, `vocabulary`, `grammar`, `pronunciation`.
Every save appends a snapshot and leaves the survey untouched.

The quiz client must generate and retain an 8–100 character alphanumeric,
hyphen, or underscore `requestId` until submission succeeds. Retries with that
same ID and answers return the original result. Reusing it for changed answers
or another task returns 409. A transaction scores against the currently
published task and creates an immutable submission, preserving the original
questions, correct answers, explanations, and task version. Later edits cannot
change a stored result. Answers and explanations are removed from public and
student task payloads; only submitted results and teacher views contain them.
Every saved task receives an opaque `version` string; older tasks can have a
numeric version from `updatedAt`. The client must send the received value as
`taskVersion` without changing its type. A stale or missing version returns
409 and does not create a grade. The student should close the quiz and refresh
the task. An already-committed request still returns its original result before
checking the current task version, preserving retry idempotency after edits.

## Verification

Run `node --test tcb-functions/learningArchiveApi/test/*.test.cjs` from the repo.
The tests use an in-memory transactional CloudBase mock and cover access,
identity boundaries, legacy preservation, signed audio scope, grading,
idempotency, ownership, pagination, throttling, and HTTP errors.

When the shared class helpers change, regenerate this function's copies with:

```text
node node_modules/typescript/bin/tsc lib/class-groups.ts lib/class-catalog.ts --module commonjs --target ES2020 --skipLibCheck --outDir tcb-functions/learningArchiveApi
```
