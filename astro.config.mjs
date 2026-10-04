import { defineConfig } from 'astro/config';
import yaml from '@rollup/plugin-yaml';

export default defineConfig({
  // Used for the canonical URL and the social preview image (they need absolute URLs).
  site: 'https://johannes-schimunek.de',
  build: { format: 'directory' },
  vite: { plugins: [yaml()] },
});
