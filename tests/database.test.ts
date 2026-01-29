/**
 * Database Layer Tests
 *
 * Tests for core database operations using mocked KV/D1
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import type { Env } from '../types/index.js';

// Extended mock types that preserve both KV interface and mock functionality
interface MockKV {
  get: Mock<(key: string) => Promise<string | null>>;
  put: Mock<(key: string, value: string, options?: unknown) => Promise<void>>;
  delete: Mock<(key: string) => Promise<void>>;
  list: Mock<() => Promise<{ keys: unknown[]; list_complete: boolean; cursor: string }>>;
  getWithMetadata: Mock<() => Promise<{ value: null; metadata: null }>>;
  _store: Map<string, string>;
}

interface MockD1 {
  prepare: Mock;
  batch: Mock;
  _setResults: (results: unknown[], changes?: number) => void;
}

interface MockEnv extends Env {
  SLOTS_KV: MockKV & KVNamespace;
  DB: MockD1 & D1Database;
}

// Mock environment factory - returns Env-compatible mock
function createMockEnv(): MockEnv {
  const kvStore = new Map<string, string>();

  const mockKV = {
    get: vi.fn(async (key: string) => kvStore.get(key) || null),
    put: vi.fn(async (key: string, value: string) => { kvStore.set(key, value); }),
    delete: vi.fn(async (key: string) => { kvStore.delete(key); }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
    getWithMetadata: vi.fn(async () => ({ value: null, metadata: null })),
    _store: kvStore
  };

  const mockD1Results: { results: unknown[]; meta: { changes: number } } = { results: [], meta: { changes: 0 } };
  const mockD1 = {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => mockD1Results.results[0] || null),
        all: vi.fn(async () => mockD1Results),
        run: vi.fn(async () => mockD1Results)
      }))
    })),
    batch: vi.fn(async () => [mockD1Results]),
    _setResults: (results: unknown[], changes = 0) => {
      mockD1Results.results = results;
      mockD1Results.meta.changes = changes;
    }
  };

  return {
    SLOTS_KV: mockKV,
    DB: mockD1,
    DUEL_ALARM: {} as DurableObjectNamespace
  } as MockEnv;
}

// ============================================
// Balance Operations Tests
// ============================================

describe('Balance Operations', () => {
  describe('getBalance', () => {
    it('returns stored balance from KV', async () => {
      const { getBalance } = await import('../database/core.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:testuser', '500');

      const balance = await getBalance('testuser', env);
      expect(balance).toBe(500);
    });

    it('returns 0 for new user without disclaimer', async () => {
      const { getBalance } = await import('../database/core.js');
      const env = createMockEnv();

      const balance = await getBalance('newuser', env);
      expect(balance).toBe(0);
    });

    it('creates starting balance for user with disclaimer', async () => {
      const { getBalance } = await import('../database/core.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('disclaimer:newuser', 'accepted');

      const balance = await getBalance('newuser', env);
      expect(balance).toBe(100); // STARTING_BALANCE
      expect(env.SLOTS_KV.put).toHaveBeenCalled();
    });

    it('caps balance at MAX_BALANCE', async () => {
      const { getBalance } = await import('../database/core.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:richuser', '999999999');

      const balance = await getBalance('richuser', env);
      expect(balance).toBeLessThanOrEqual(1000000000); // MAX_BALANCE
    });

    it('handles invalid balance value gracefully', async () => {
      const { getBalance } = await import('../database/core.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:baddata', 'notanumber');

      const balance = await getBalance('baddata', env);
      expect(balance).toBe(0);
    });
  });

  describe('setBalance', () => {
    it('writes balance to KV', async () => {
      const { setBalance } = await import('../database/core.js');
      const env = createMockEnv();

      await setBalance('testuser', 1000, env);
      expect(env.SLOTS_KV.put).toHaveBeenCalledWith('user:testuser', '1000');
    });

    it('clamps negative balance to 0', async () => {
      const { setBalance } = await import('../database/core.js');
      const env = createMockEnv();

      await setBalance('testuser', -100, env);
      expect(env.SLOTS_KV.put).toHaveBeenCalledWith('user:testuser', '0');
    });

    it('clamps balance above MAX_BALANCE', async () => {
      const { setBalance } = await import('../database/core.js');
      const env = createMockEnv();

      await setBalance('testuser', 9999999999, env);
      // Should be clamped to MAX_BALANCE (1000000000)
      const calledWith = env.SLOTS_KV.put.mock.calls[0];
      expect(parseInt(calledWith[1], 10)).toBeLessThanOrEqual(1000000000);
    });
  });

  describe('adjustBalance', () => {
    it('adds positive delta to balance', async () => {
      const { adjustBalance } = await import('../database/core.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:testuser', '500');

      const newBalance = await adjustBalance('testuser', 100, env);
      expect(newBalance).toBe(600);
    });

    it('subtracts negative delta from balance', async () => {
      const { adjustBalance } = await import('../database/core.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:testuser', '500');

      const newBalance = await adjustBalance('testuser', -200, env);
      expect(newBalance).toBe(300);
    });

    it('does not go below 0', async () => {
      const { adjustBalance } = await import('../database/core.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:testuser', '100');

      const newBalance = await adjustBalance('testuser', -500, env);
      expect(newBalance).toBe(0);
    });

    it('does not exceed MAX_BALANCE', async () => {
      const { adjustBalance } = await import('../database/core.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:testuser', '999999990');

      const newBalance = await adjustBalance('testuser', 100, env);
      expect(newBalance).toBeLessThanOrEqual(1000000000);
    });
  });

  describe('deductBalance', () => {
    it('deducts amount when balance is sufficient', async () => {
      const { deductBalance } = await import('../database/core.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:testuser', '500');
      // Mock D1 success
      env.DB._setResults([{ balance: 400 }], 1);

      const result = await deductBalance('testuser', 100, env);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(400);
    });

    it('fails when balance is insufficient', async () => {
      const { deductBalance } = await import('../database/core.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:testuser', '50');
      // Mock D1 failure (no result = insufficient)
      env.DB._setResults([], 0);

      const result = await deductBalance('testuser', 100, env);
      expect(result.success).toBe(false);
    });
  });

  describe('creditBalance', () => {
    it('adds amount to balance', async () => {
      const { creditBalance } = await import('../database/core.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:testuser', '500');
      // Mock D1 success
      env.DB._setResults([{ balance: 600 }], 1);

      const newBalance = await creditBalance('testuser', 100, env);
      expect(newBalance).toBe(600);
    });
  });
});

// ============================================
// Disclaimer Tests
// ============================================

describe('Disclaimer Operations', () => {
  describe('hasAcceptedDisclaimer', () => {
    it('returns true for accepted disclaimer', async () => {
      const { hasAcceptedDisclaimer } = await import('../database/core.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('disclaimer:testuser', 'accepted');

      const result = await hasAcceptedDisclaimer('testuser', env);
      expect(result).toBe(true);
    });

    it('returns false for unaccepted disclaimer', async () => {
      const { hasAcceptedDisclaimer } = await import('../database/core.js');
      const env = createMockEnv();

      const result = await hasAcceptedDisclaimer('newuser', env);
      expect(result).toBe(false);
    });
  });

  describe('setDisclaimerAccepted', () => {
    it('stores disclaimer acceptance', async () => {
      const { setDisclaimerAccepted } = await import('../database/core.js');
      const env = createMockEnv();

      await setDisclaimerAccepted('testuser', env);
      expect(env.SLOTS_KV.put).toHaveBeenCalledWith('disclaimer:testuser', 'accepted');
    });
  });
});

// ============================================
// Self-Ban Tests
// ============================================

describe('Self-Ban Operations', () => {
  describe('isSelfBanned', () => {
    it('returns ban data for banned user', async () => {
      const { isSelfBanned } = await import('../database/core.js');
      const env = createMockEnv();
      const banData = JSON.stringify({ timestamp: Date.now(), date: '2026-01-29' });
      env.SLOTS_KV._store.set('selfban:testuser', banData);

      const result = await isSelfBanned('testuser', env);
      expect(result).toBeTruthy();
      expect(result?.date).toBe('2026-01-29');
    });

    it('returns null for non-banned user', async () => {
      const { isSelfBanned } = await import('../database/core.js');
      const env = createMockEnv();

      const result = await isSelfBanned('normaluser', env);
      expect(result).toBeNull();
    });
  });

  describe('setSelfBan', () => {
    it('stores self-ban with date', async () => {
      const { setSelfBan } = await import('../database/core.js');
      const env = createMockEnv();

      await setSelfBan('testuser', env);
      expect(env.SLOTS_KV.put).toHaveBeenCalled();
      const calledWith = env.SLOTS_KV.put.mock.calls[0];
      expect(calledWith[0]).toBe('selfban:testuser');
      const data = JSON.parse(calledWith[1]);
      expect(data.timestamp).toBeDefined();
      expect(data.date).toBeDefined();
    });
  });

  describe('removeSelfBan', () => {
    it('removes self-ban', async () => {
      const { removeSelfBan } = await import('../database/core.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('selfban:testuser', '{"timestamp":123}');

      await removeSelfBan('testuser', env);
      expect(env.SLOTS_KV.delete).toHaveBeenCalledWith('selfban:testuser');
    });
  });
});

// ============================================
// Cooldown Tests
// ============================================

describe('Cooldown Operations', () => {
  describe('getLastSpin', () => {
    it('returns timestamp for existing cooldown', async () => {
      const { getLastSpin } = await import('../database/core.js');
      const env = createMockEnv();
      const timestamp = Date.now().toString();
      env.SLOTS_KV._store.set('cooldown:testuser', timestamp);

      const result = await getLastSpin('testuser', env);
      expect(result).toBe(parseInt(timestamp, 10));
    });

    it('returns null for no cooldown', async () => {
      const { getLastSpin } = await import('../database/core.js');
      const env = createMockEnv();

      const result = await getLastSpin('newuser', env);
      expect(result).toBeNull();
    });
  });

  describe('setLastSpin', () => {
    it('stores spin timestamp with TTL', async () => {
      const { setLastSpin } = await import('../database/core.js');
      const env = createMockEnv();
      const timestamp = Date.now();

      await setLastSpin('testuser', timestamp, env);
      expect(env.SLOTS_KV.put).toHaveBeenCalled();
      const calledWith = env.SLOTS_KV.put.mock.calls[0];
      expect(calledWith[0]).toBe('cooldown:testuser');
      expect(calledWith[2]).toHaveProperty('expirationTtl');
    });
  });
});

// ============================================
// Daily Operations Tests
// ============================================

describe('Daily Operations', () => {
  describe('getLastDaily', () => {
    it('returns timestamp for claimed daily', async () => {
      const { getLastDaily } = await import('../database/core.js');
      const env = createMockEnv();
      const timestamp = Date.now().toString();
      env.SLOTS_KV._store.set('daily:testuser', timestamp);

      const result = await getLastDaily('testuser', env);
      expect(result).toBe(parseInt(timestamp, 10));
    });

    it('returns null for unclaimed daily', async () => {
      const { getLastDaily } = await import('../database/core.js');
      const env = createMockEnv();

      const result = await getLastDaily('newuser', env);
      expect(result).toBeNull();
    });
  });

  describe('setLastDaily', () => {
    it('stores daily timestamp with TTL', async () => {
      const { setLastDaily } = await import('../database/core.js');
      const env = createMockEnv();
      const timestamp = Date.now();

      await setLastDaily('testuser', timestamp, env);
      expect(env.SLOTS_KV.put).toHaveBeenCalled();
      const calledWith = env.SLOTS_KV.put.mock.calls[0];
      expect(calledWith[0]).toBe('daily:testuser');
    });
  });
});

// ============================================
// Custom Messages Tests
// ============================================

describe('Custom Messages', () => {
  describe('getCustomMessages', () => {
    it('returns stored custom messages', async () => {
      const { getCustomMessages } = await import('../database/core.js');
      const env = createMockEnv();
      const messages = JSON.stringify({ win: ['GG!'], loss: [':('] });
      env.SLOTS_KV._store.set('custom_messages:testuser', messages);

      const result = await getCustomMessages('testuser', env);
      expect(result).toEqual({ win: ['GG!'], loss: [':('] });
    });

    it('returns null for no custom messages', async () => {
      const { getCustomMessages } = await import('../database/core.js');
      const env = createMockEnv();

      const result = await getCustomMessages('newuser', env);
      expect(result).toBeNull();
    });
  });

  describe('setCustomMessages', () => {
    it('stores custom messages', async () => {
      const { setCustomMessages } = await import('../database/core.js');
      const env = createMockEnv();
      const messages = { win: ['Nice!'], loss: ['Oops'] };

      const result = await setCustomMessages('testuser', messages, env);
      expect(result).toBe(true);
      expect(env.SLOTS_KV.put).toHaveBeenCalled();
    });
  });
});

// ============================================
// Activity Tracking Tests
// ============================================

describe('Activity Tracking', () => {
  describe('getLastActive', () => {
    it('returns last active timestamp', async () => {
      const { getLastActive } = await import('../database/core.js');
      const env = createMockEnv();
      const timestamp = Date.now().toString();
      env.SLOTS_KV._store.set('lastActive:testuser', timestamp);

      const result = await getLastActive('testuser', env);
      expect(result).toBe(parseInt(timestamp, 10));
    });
  });

  describe('setLastActive', () => {
    it('stores activity timestamp', async () => {
      const { setLastActive } = await import('../database/core.js');
      const env = createMockEnv();

      await setLastActive('testuser', env);
      expect(env.SLOTS_KV.put).toHaveBeenCalled();
      const calledWith = env.SLOTS_KV.put.mock.calls[0];
      expect(calledWith[0]).toBe('lastActive:testuser');
    });
  });
});
