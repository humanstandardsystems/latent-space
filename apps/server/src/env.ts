export const env = {
  DATABASE_URL: process.env['DATABASE_URL'] ?? './latent-space.db',
  SESSION_SECRET: process.env['SESSION_SECRET'] ?? 'dev-secret-change-in-production-32ch',
  RESEND_API_KEY: process.env['RESEND_API_KEY'] ?? '',
  MAGIC_LINK_BASE_URL: process.env['MAGIC_LINK_BASE_URL'] ?? 'http://localhost:3001',
  CLIENT_URL: process.env['CLIENT_URL'] ?? 'http://localhost:5173',
  PORT: Number(process.env['PORT'] ?? 3001),
};
