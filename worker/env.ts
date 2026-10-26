export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  // vars (wrangler.toml)
  R2_ACCOUNT_ID: string;
  R2_BUCKET_NAME: string;
  // secrets (wrangler secret put)
  SHARED_PASSWORD: string;
  SESSION_SECRET: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
}

export type AppEnv = { Bindings: Env };
