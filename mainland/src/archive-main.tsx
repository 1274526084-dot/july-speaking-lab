import React from 'react';
import { createRoot } from 'react-dom/client';
import { ArchiveStudent } from './archive-student';
import { ArchiveTeacher } from './archive-teacher';
import './styles.css';

const isTeacher = window.location.pathname.replace(/\/+$/, '').endsWith('/archive/teacher');
createRoot(document.getElementById('root')!).render(<React.StrictMode>{isTeacher ? <ArchiveTeacher /> : <ArchiveStudent />}</React.StrictMode>);
