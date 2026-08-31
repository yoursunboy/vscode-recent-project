import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

await build({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  // sql.js 的 Emscripten 胶水层在打包下容易出问题，保持 external 从 node_modules 加载
  external: ['vscode', 'sql.js'],
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: true,
  logLevel: 'info',
});

cpSync('media', 'dist/media', { recursive: true });
cpSync('node_modules/sql.js/dist/sql-wasm.wasm', 'dist/sql-wasm.wasm');

console.log('build done -> dist/extension.js');
