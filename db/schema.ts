import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const speakingAttempts = sqliteTable('speaking_attempts', {
  id: text('id').primaryKey(),
  studentName: text('student_name').notNull(),
  studentId: text('student_id').notNull(),
  className: text('class_name').notNull(),
  sceneId: text('scene_id').notNull(),
  sceneTitle: text('scene_title').notNull(),
  transcript: text('transcript').notNull(),
  coverage: integer('coverage').notNull(),
  confidence: integer('confidence'),
  durationSeconds: integer('duration_seconds').notNull(),
  attempts: integer('attempts').notNull(),
  submittedAt: integer('submitted_at').notNull(),
}, (table) => [
  index('idx_attempts_submitted_at').on(table.submittedAt),
  index('idx_attempts_scene_id').on(table.sceneId),
  index('idx_attempts_student_id').on(table.studentId),
]);
