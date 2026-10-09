import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// 영상마다 폴더 하나(폴더 이름 = 영상 ID)에 index.html 이 있다. 목록 페이지와 함께 모두 진입점으로 잡는다.
// 개발용 미리보기 페이지(preview.html)는 빌드하지 않는다.
const root = import.meta.dirname;
const videoPages = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && existsSync(resolve(root, entry.name, 'index.html')))
  .map((entry) => resolve(root, entry.name, 'index.html'));

export default defineConfig({
  // 사이트의 하위 경로(/explain-youtube-videos/)에 올라가므로 자원 경로를 상대 경로로 만든다.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 3D 장면에서만 쓰는 three.js 묶음(약 740KB)은 따로 받으므로 경고 기준을 그보다 조금 높인다.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      input: [resolve(root, 'index.html'), ...videoPages],
    },
  },
});
