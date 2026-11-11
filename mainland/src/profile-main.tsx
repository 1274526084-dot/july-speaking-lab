import React from 'react';
import { createRoot } from 'react-dom/client';
import { ProfileStudent } from './profile-student';
import { ProfileTeacher } from './profile-teacher';
import { ProfileTeacherLogin } from './profile-teacher-login';
import { followTeacherSessionChanges } from './teacher-session';
import './profile-styles.css';

const path = window.location.pathname.replace(/\/+$/, '');
if (path.endsWith('/profile/teacher') || path.endsWith('/profile/teacher/login')) followTeacherSessionChanges();
const content = path.endsWith('/profile/teacher/login')
  ? <ProfileTeacherLogin />
  : path.endsWith('/profile/teacher')
    ? <ProfileTeacher />
    : <ProfileStudent />;

createRoot(document.getElementById('root')!).render(<React.StrictMode>{content}</React.StrictMode>);
