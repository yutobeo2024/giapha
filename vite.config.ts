import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {execSync} from 'child_process';
import {readFileSync} from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

/**
 * Mã bản build: "<version trong package.json>+<commit ngắn>", thêm "-<giờ>" nếu cây làm việc có sửa chưa commit.
 * Được nhúng vào bundle (`__BUILD_ID__`) và ghi ra `dist/version.json`; trang đang mở so hai bên để biết có bản mới.
 */
function buildId(): string {
  const {version} = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf8')) as {version: string};
  let commit = 'local';
  let dirty = false;
  try {
    commit = execSync('git rev-parse --short HEAD', {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
    dirty = execSync('git status --porcelain --untracked-files=no', {stdio: ['ignore', 'pipe', 'ignore']}).toString().trim().length > 0;
  } catch {
    /* không có git: dùng "local" */
  }
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  return `${version}+${commit}${dirty || commit === 'local' ? `-${stamp}` : ''}`;
}

/** Ghi dist/version.json để trang đang mở hỏi "bản mới nhất là gì?" mà không bị cache */
function versionFile(id: string): Plugin {
  return {
    name: 'giapha-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({type: 'asset', fileName: 'version.json', source: JSON.stringify({build: id})});
    },
  };
}

const BUILD_ID = buildId();

export default defineConfig({
  plugins: [react(), tailwindcss(), versionFile(BUILD_ID)],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
