import React from 'react';
import { createRoot } from 'react-dom/client';
import { SpeakingLab } from '@/components/speaking-lab';
import { TeacherApp } from './teacher-app';
import { TeacherLogin } from './teacher-login';
import { LearningHub } from './learning-hub';
import { TeacherWorkbench, TeacherWorkbenchLogin } from './teacher-workbench';
import { CLOUDBASE_API_URL, sitePath } from './api';
import './styles.css';

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const content = path.endsWith('/workbench/login')
  ? <TeacherWorkbenchLogin />
  : path.endsWith('/workbench')
    ? <TeacherWorkbench />
    : path.endsWith('/teacher/login')
  ? <TeacherLogin />
  : path.endsWith('/teacher')
    ? <TeacherApp />
    : path === sitePath().replace(/\/+$/, '')
      ? <LearningHub />
      : <SpeakingLab
        apiMode="cloudbase"
        apiUrl={CLOUDBASE_API_URL}
        assetBase={import.meta.env.BASE_URL.replace(/\/$/, '')}
        teacherHref={sitePath('teacher')}
      />;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{content}</React.StrictMode>,
);
