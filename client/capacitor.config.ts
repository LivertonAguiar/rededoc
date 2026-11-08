import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'br.com.lpaguiar.itfy',
  appName: 'ITFY',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: ['itfy.lpaguiar.com.br']
  },
  android: {
    allowMixedContent: true,
    captureInput: true
  }
};

export default config;
