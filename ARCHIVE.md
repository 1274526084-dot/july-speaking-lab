# Railway English learning archive

This is an additive module for the existing GitHub Pages / Tencent CloudBase platform.
It does not replace the independent word, speaking or survey pages.

## Entry points

- Student: `/july-speaking-lab/archive/`
- Teacher: `/july-speaking-lab/archive/teacher/`
- Existing student hub and teacher workbench link to the new module.
- Existing URLs and QR targets remain unchanged.

## Student workflow

Students enter their name and full class, then show a six-digit request code to a teacher.
The teacher confirms identity before a device can read that student's records.
There is no student password to memorize. On a new device or after clearing the browser,
the student requests confirmation again. Remembering this personal device is optional
and lasts up to 30 days. Shared devices should use the default temporary session and log out.
Teachers can revoke lost-device access. Name and class alone do not unlock private data.

The seven-axis radar displays self-assessment, not a standardized proficiency score.
Word, speaking and quiz evidence is displayed separately; missing grades are not zero.
New self-assessments append snapshots without replacing the initial survey.
The fictional railway learning companion is student-selected, not inferred from scores.
The illustration selection is currently remembered on this browser only.

## Teacher workflow

- Use the existing teacher login and open the archive from the workbench.
- Filter existing class aliases without modifying raw student submissions.
- Inspect class summaries, individual records, recordings and self-assessment history.
- Create tasks grouped by unit and lesson, with class targeting and optional deadlines.
- Assemble editable quizzes from 20 railway scenarios; this is a question bank, not AI generation.
- The bundled question bank is public practice material, not a confidential examination bank.
- Check each question, answer and target class before publication.
- Review railway news suggestions with source/date and publish explicitly.
- Approve device requests only after checking the student's identity and on-screen code.
- The teacher dashboard and every individual-record endpoint enforce class ownership on
  the server: Lisa, Alice and Cherie see only their assigned classes. July can inspect
  the whole course and change the class-to-teacher assignments.
- `archive/teacher/?tab=overview` shows class-level aggregates for all four teachers;
  it does not expose other teachers' individual student records. July can edit the
  ownership list there. New tasks remain visible in the shared teacher task library,
  but non-July teachers can publish only to their own classes.

## October 2026 roster correction

The private `2026级新生报到名单.xls` is used locally, not uploaded to GitHub.
July-only `adminClassAudit` and `adminClassMigration` validate the original
record fingerprint and record an idempotent reassignment in the existing
`english_archive_class_normalization` collection. The original survey,
word/speaking grade, recording and archive student documents remain untouched.
Only unambiguous roster matches are reassigned. Missing names, names with
conflicting IDs, and records outside the currently supported class catalog
remain in the default class for manual review.

Read/listening/writing tasks currently distribute materials or links. Native answer submission
and scoring in this module is implemented for multiple-choice quizzes; the existing word
and speaking activities keep their original submission workflows.

## Safety and verification

See `tcb-functions/learningArchiveApi/README.md` for access boundaries, new collection rules,
pagination limits, scoring idempotency and deployment order. Deploy and verify the new API
before publishing the frontend. Never commit `.qa`, auth stores, or production student exports.
Only the project's archive collections receive writes from the archive API.
The Malaysian project and original learning records are not rewritten or migrated.

Local checks include TypeScript, scoped lint, class alias regression tests, archive API mock
tests and desktop/mobile UI fixtures. Live verification must use read-only production data
checks; do not invent test pupils in the production archive.
