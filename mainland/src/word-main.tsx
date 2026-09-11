import React from 'react';
import { createRoot } from 'react-dom/client';
import { WordStaff } from './word-staff';
import { WordStudent } from './word-student';
import './word-styles.css';

const path = window.location.pathname.replace(/\/+$/, '');
const content = path.endsWith('/words/admin') ? <WordStaff mode="admin" /> : path.endsWith('/words/teacher') ? <WordStaff mode="teacher" /> : <WordStudent />;

createRoot(document.getElementById('root')!).render(<React.StrictMode>{content}</React.StrictMode>);
