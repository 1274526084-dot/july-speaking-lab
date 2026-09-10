import React from 'react';
import { createRoot } from 'react-dom/client';
import { SpeakingLab } from '@/components/speaking-lab';
import { TeacherApp } from './teacher-app';
import { TeacherLogin } from './teacher-login';
import './styles.css';

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const content = path.endsWith('/teacher/login')
  ? <TeacherLogin />
  : path.endsWith('/teacher')
    ? <TeacherApp />
    : <SpeakingLab />;

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{content}</React.StrictMode>,
);
