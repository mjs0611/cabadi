import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'cabadi',
  brand: {
    displayName: '카바디',
    primaryColor: '#6B8E23',
    icon: '',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  webViewProps: {
    type: 'game',
  },
  permissions: [],
});
