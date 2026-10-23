// Imported first so .env is loaded before any module reads process.env.
try {
  process.loadEnvFile();
} catch {
  // No .env file: fine, everything has a default.
}
