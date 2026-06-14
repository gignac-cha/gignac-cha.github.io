import basicSsl from '@vitejs/plugin-basic-ssl';
// test 키(vitest 설정)의 타입 오류를 피하기 위해 defineConfig 를 vitest/config 에서 가져옵니다.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [basicSsl()],
  resolve: {
    alias: {
      'three/webgpu': 'https://fastly.jsdelivr.net/npm/three@latest/build/three.webgpu.js',
      three: 'https://fastly.jsdelivr.net/npm/three@latest/build/three.webgpu.js',
    },
  },
  build: {
    outDir: 'outputs',
    rollupOptions: {
      external: ['three', 'three/webgpu', 'd3'],
    },
  },
  test: {
    include: ['**/*.tests.ts'],
  },
});
