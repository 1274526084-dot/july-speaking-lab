import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { defineConfig } from 'vite';

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(projectDir, 'mainland');
const releaseId = '20260915-profile1';

export default defineConfig({
  root: webRoot,
  base: '/july-speaking-lab/',
  publicDir: path.join(projectDir, 'public'),
  plugins: [
    react(),
    legacy({
      targets: ['Chrome >= 49', 'Android >= 5', 'iOS >= 10'],
      renderLegacyChunks: true,
      modernPolyfills: true,
    }),
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
    // Keep older bundles so a cached HTML page on WeChat/Chaoxing never points to a deleted file.
    emptyOutDir: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${releaseId}.js`,
        chunkFileNames: `assets/chunks/[name]-${releaseId}.js`,
        assetFileNames: `assets/[name]-${releaseId}[extname]`,
      },
      input: {
        home: path.join(webRoot, 'index.html'),
        student: path.join(webRoot, 'student', 'index.html'),
        teacher: path.join(webRoot, 'teacher', 'index.html'),
        teacherLogin: path.join(webRoot, 'teacher', 'login', 'index.html'),
        wordStudent: path.join(webRoot, 'words', 'index.html'),
        wordTeacher: path.join(webRoot, 'words', 'teacher', 'index.html'),
        wordAdmin: path.join(webRoot, 'words', 'admin', 'index.html'),
        profileStudent: path.join(webRoot, 'profile', 'index.html'),
        profileTeacher: path.join(webRoot, 'profile', 'teacher', 'index.html'),
        profileTeacherLogin: path.join(webRoot, 'profile', 'teacher', 'login', 'index.html'),
      },
    },
  },
});
