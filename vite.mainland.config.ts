import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(projectDir, 'mainland');

export default defineConfig({
  root: webRoot,
  base: '/july-speaking-lab/',
  publicDir: path.join(projectDir, 'public'),
  plugins: [
    react(),
    {
      name: 'github-pages-nojekyll',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
      },
    },
  ],
  resolve: {
    alias: { '@': projectDir },
  },
  css: {
    postcss: { plugins: [tailwindcss()] },
  },
  build: {
    outDir: path.join(projectDir, 'docs'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        home: path.join(webRoot, 'index.html'),
        student: path.join(webRoot, 'student', 'index.html'),
        teacher: path.join(webRoot, 'teacher', 'index.html'),
        teacherLogin: path.join(webRoot, 'teacher', 'login', 'index.html'),
        wordStudent: path.join(webRoot, 'words', 'index.html'),
        wordTeacher: path.join(webRoot, 'words', 'teacher', 'index.html'),
        wordAdmin: path.join(webRoot, 'words', 'admin', 'index.html'),
      },
    },
  },
});
