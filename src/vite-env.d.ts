/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_TENANT_ID: string;
  /** URL por defecto del webhook de Apps Script (opcional; el tenant puede sobreescribir). */
  readonly VITE_CALENDAR_WEBHOOK_URL?: string;
  /** Token compartido enviado al webhook para validar el origen. */
  readonly VITE_CALENDAR_WEBHOOK_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.json' {
  const value: unknown;
  export default value;
}
