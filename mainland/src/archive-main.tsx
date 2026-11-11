import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArchiveStudent } from './archive-student';
import { ArchiveTeacher } from './archive-teacher';
import { TeacherTaskPage } from './teacher-task-tools';
import { followTeacherSessionChanges } from './teacher-session';
import './styles.css';

const isTeacher = window.location.pathname.replace(/\/+$/, '').endsWith('/archive/teacher');
if (isTeacher) followTeacherSessionChanges();
const teacherTaskId = isTeacher && new URLSearchParams(window.location.search).get('task');
createRoot(document.getElementById('root')!).render(<React.StrictMode>{teacherTaskId ? <TeacherTaskPage taskId={teacherTaskId} /> : isTeacher ? <ArchiveTeacher /> : <ArchiveStudent />}</React.StrictMode>);
