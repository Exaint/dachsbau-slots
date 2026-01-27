/**
 * Mock for cloudflare:workers module (used in Vitest)
 * Provides stub DurableObject base class so tests can import
 * modules that depend on Durable Objects.
 */
export class DurableObject {
  ctx: unknown;
  env: unknown;
  constructor(ctx: unknown, env: unknown) {
    this.ctx = ctx;
    this.env = env;
  }
}
