// Centralized env reads. Throws at module-load time on the server when a
// required value is missing — fail fast rather than letting missing config
// surface as a confusing runtime auth/email error.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const env = {
  databaseUrl: required("DATABASE_URL"),
  databaseAuthToken: optional("DATABASE_AUTH_TOKEN"),
  betterAuthSecret: required("BETTER_AUTH_SECRET"),
  betterAuthUrl: required("BETTER_AUTH_URL"),
  resendApiKey: required("RESEND_API_KEY"),
  emailFrom: required("EMAIL_FROM"),
};
