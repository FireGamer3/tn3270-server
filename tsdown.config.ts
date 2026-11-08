import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    platform: 'node',
    target: 'node22',
    tsconfig: 'src/tsconfig.json',
    dts: true,
    fixedExtension: true,
    clean: true,
});
