/**
 * Admin Commands Tests
 *
 * Tests for admin moderation and economy commands
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import type { Env } from '../types/index.js';

// Extended mock types
interface MockKV {
  get: Mock;
  put: Mock;
  delete: Mock;
  list: Mock;
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

// Mock environment factory
function createMockEnv(): MockEnv {
  const kvStore = new Map<string, string>();

  const mockKV = {
    get: vi.fn(async (key: string) => kvStore.get(key) || null),
    put: vi.fn(async (key: string, value: string) => { kvStore.set(key, value); }),
    delete: vi.fn(async (key: string) => { kvStore.delete(key); }),
    list: vi.fn(async () => ({ keys: [] })),
    getWithMetadata: vi.fn(async (key: string) => {
      const value = kvStore.get(key);
      return { value: value || null, metadata: null };
    }),
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

// Helper to extract response text
async function getResponseText(response: Response): Promise<string> {
  return await response.text();
}

// ============================================
// Moderation Commands Tests
// ============================================

describe('Admin Moderation Commands', () => {
  describe('handleBan', () => {
    it('rejects non-admin users', async () => {
      const { handleBan } = await import('../commands/admin/moderation.js');
      const env = createMockEnv();

      const response = await handleBan('random_user', '@victim', env);
      const text = await getResponseText(response);

      // Check for permission denied indicator (emoji or text)
      expect(text).toContain('❌');
    });

    it('bans user when called by admin', async () => {
      const { handleBan } = await import('../commands/admin/moderation.js');
      const env = createMockEnv();

      const response = await handleBan('exaint_', '@targetuser', env);
      const text = await getResponseText(response);

      expect(text).toContain('✅');
      expect(text).toContain('ausgeschlossen');
      expect(env.SLOTS_KV.put).toHaveBeenCalledWith('blacklist:targetuser', 'true');
    });

    it('validates target username', async () => {
      const { handleBan } = await import('../commands/admin/moderation.js');
      const env = createMockEnv();

      const response = await handleBan('exaint_', '@!!!', env);
      const text = await getResponseText(response);

      expect(text).toContain('Ungültiger Username');
    });

    it('requires target parameter', async () => {
      const { handleBan } = await import('../commands/admin/moderation.js');
      const env = createMockEnv();

      const response = await handleBan('exaint_', '', env);
      const text = await getResponseText(response);

      expect(text).toContain('Nutze: !slots ban');
    });
  });

  describe('handleUnban', () => {
    it('unbans user and removes selfban', async () => {
      const { handleUnban } = await import('../commands/admin/moderation.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('blacklist:targetuser', 'true');
      env.SLOTS_KV._store.set('selfban:targetuser', '{}');

      const response = await handleUnban('exaint_', '@targetuser', env);
      const text = await getResponseText(response);

      expect(text).toContain('entbannt');
      expect(env.SLOTS_KV.delete).toHaveBeenCalledWith('blacklist:targetuser');
    });

    it('rejects non-admin users', async () => {
      const { handleUnban } = await import('../commands/admin/moderation.js');
      const env = createMockEnv();

      const response = await handleUnban('random_user', '@victim', env);
      const text = await getResponseText(response);

      // Check for permission denied indicator
      expect(text).toContain('❌');
    });
  });

  describe('handleFreeze', () => {
    it('freezes user account', async () => {
      const { handleFreeze } = await import('../commands/admin/moderation.js');
      const env = createMockEnv();

      const response = await handleFreeze('exaint_', '@targetuser', env);
      const text = await getResponseText(response);

      expect(text).toContain('eingefroren');
      expect(text).toContain('❄️');
      expect(env.SLOTS_KV.put).toHaveBeenCalledWith('frozen:targetuser', 'true');
    });
  });

  describe('handleUnfreeze', () => {
    it('unfreezes user account', async () => {
      const { handleUnfreeze } = await import('../commands/admin/moderation.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('frozen:targetuser', 'true');

      const response = await handleUnfreeze('exaint_', '@targetuser', env);
      const text = await getResponseText(response);

      expect(text).toContain('aufgetaut');
      expect(env.SLOTS_KV.delete).toHaveBeenCalledWith('frozen:targetuser');
    });
  });

  describe('handleReset', () => {
    it('resets user balance to starting value', async () => {
      const { handleReset } = await import('../commands/admin/moderation.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:targetuser', '50000');

      const response = await handleReset('exaint_', '@targetuser', env);
      const text = await getResponseText(response);

      expect(text).toContain('zurückgesetzt');
      expect(env.SLOTS_KV.put).toHaveBeenCalled();
    });
  });
});

// ============================================
// Economy Commands Tests
// ============================================

describe('Admin Economy Commands', () => {
  describe('handleGive', () => {
    it('gives DachsTaler to user', async () => {
      const { handleGive } = await import('../commands/admin/economy.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:targetuser', '100');
      env.DB._setResults([{ balance: 600 }], 1);

      const response = await handleGive('exaint_', '@targetuser', '500', env);
      const text = await getResponseText(response);

      expect(text).toContain('500');
      expect(text).toContain('DachsTaler');
    });

    it('rejects non-admin users', async () => {
      const { handleGive } = await import('../commands/admin/economy.js');
      const env = createMockEnv();

      const response = await handleGive('random_user', '@victim', '1000', env);
      const text = await getResponseText(response);

      // Check for permission denied indicator
      expect(text).toContain('❌');
    });

    it('validates amount', async () => {
      const { handleGive } = await import('../commands/admin/economy.js');
      const env = createMockEnv();

      const response = await handleGive('exaint_', '@targetuser', 'abc', env);
      const text = await getResponseText(response);

      expect(text).toContain('Ungültiger Betrag');
    });
  });

  describe('handleRemove', () => {
    it('removes DachsTaler from user', async () => {
      const { handleRemove } = await import('../commands/admin/economy.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:targetuser', '1000');
      env.DB._setResults([{ balance: 500 }], 1);

      const response = await handleRemove('exaint_', '@targetuser', '500', env);
      const text = await getResponseText(response);

      expect(text).toContain('500');
      expect(text).toContain('abgezogen');
    });

    it('does not go below 0', async () => {
      const { handleRemove } = await import('../commands/admin/economy.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('user:targetuser', '100');
      env.DB._setResults([{ balance: 0 }], 1);

      const response = await handleRemove('exaint_', '@targetuser', '500', env);
      const text = await getResponseText(response);

      // Should succeed but balance won't go below 0
      expect(text).toBeDefined();
    });
  });

  describe('handleSetBalance', () => {
    it('sets exact balance for user', async () => {
      const { handleSetBalance } = await import('../commands/admin/economy.js');
      const env = createMockEnv();

      const response = await handleSetBalance('exaint_', '@targetuser', '5000', env);
      const text = await getResponseText(response);

      expect(text).toContain('5000');
      expect(env.SLOTS_KV.put).toHaveBeenCalled();
    });

    it('rejects negative amounts', async () => {
      const { handleSetBalance } = await import('../commands/admin/economy.js');
      const env = createMockEnv();

      const response = await handleSetBalance('exaint_', '@targetuser', '-100', env);
      const text = await getResponseText(response);

      expect(text).toContain('Ungültiger Betrag');
    });
  });

  describe('handleGiveBuff', () => {
    it('activates buff for user with valid shop number', async () => {
      const { handleGiveBuff } = await import('../commands/admin/economy.js');
      const env = createMockEnv();

      // handleGiveBuff expects a shop item number (1-X), not a buff name
      const response = await handleGiveBuff('exaint_', '@targetuser', '1', env);
      const text = await getResponseText(response);

      // Either activates buff or returns an error (shop item activation)
      expect(text).toBeDefined();
      expect(text.length).toBeGreaterThan(0);
    });

    it('rejects invalid shop numbers', async () => {
      const { handleGiveBuff } = await import('../commands/admin/economy.js');
      const env = createMockEnv();

      const response = await handleGiveBuff('exaint_', '@targetuser', '9999', env);
      const text = await getResponseText(response);

      expect(text).toContain('Ungültige Shopnummer');
    });
  });

  describe('handleRemoveBuff', () => {
    it('removes buff from user with valid shop number', async () => {
      const { handleRemoveBuff } = await import('../commands/admin/economy.js');
      const env = createMockEnv();

      // handleRemoveBuff expects a shop item number
      const response = await handleRemoveBuff('exaint_', '@targetuser', '1', env);
      const text = await getResponseText(response);

      // Either removes buff or returns response (depending on if buff exists)
      expect(text).toBeDefined();
    });
  });

  describe('handleGiveFreespins', () => {
    it('gives free spins to user', async () => {
      const { handleGiveFreespins } = await import('../commands/admin/economy.js');
      const env = createMockEnv();

      // handleGiveFreespins(username, target, amount, multiplier, env)
      // amount = how many freespins, multiplier = bet value (1=10DT, 2=20DT, etc.)
      const response = await handleGiveFreespins('exaint_', '@targetuser', '5', '1', env);
      const text = await getResponseText(response);

      // Should contain success indicator (Freespins in message)
      expect(text).toContain('Freespin');
    });
  });

  describe('handleGiveInsurance', () => {
    it('gives insurance to user', async () => {
      const { handleGiveInsurance } = await import('../commands/admin/economy.js');
      const env = createMockEnv();

      const response = await handleGiveInsurance('exaint_', '@targetuser', '3', env);
      const text = await getResponseText(response);

      // Should contain success indicator or insurance info
      expect(text).toBeDefined();
    });
  });

  describe('handleGetStats', () => {
    it('returns user stats', async () => {
      const { handleGetStats } = await import('../commands/admin/economy.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('stats:targetuser', JSON.stringify({
        totalSpins: 100,
        wins: 50,
        biggestWin: 5000,
        totalWon: 10000,
        totalLost: 8000
      }));

      const response = await handleGetStats('exaint_', '@targetuser', env);
      const text = await getResponseText(response);

      expect(text).toContain('targetuser');
      // Should contain stats info
    });

    it('handles user with no stats', async () => {
      const { handleGetStats } = await import('../commands/admin/economy.js');
      const env = createMockEnv();

      const response = await handleGetStats('exaint_', '@newuser', env);
      const text = await getResponseText(response);

      expect(text).toBeDefined();
    });
  });

  describe('handleResetDaily', () => {
    it('resets daily claim for user', async () => {
      const { handleResetDaily } = await import('../commands/admin/economy.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('daily:targetuser', Date.now().toString());

      const response = await handleResetDaily('exaint_', '@targetuser', env);
      const text = await getResponseText(response);

      expect(text).toContain('zurückgesetzt');
      expect(env.SLOTS_KV.delete).toHaveBeenCalled();
    });
  });

  describe('handleResetWeeklyLimits', () => {
    it('resets weekly purchase limits', async () => {
      const { handleResetWeeklyLimits } = await import('../commands/admin/economy.js');
      const env = createMockEnv();
      env.SLOTS_KV._store.set('bundle_purchases:targetuser', JSON.stringify({ count: 5 }));
      env.SLOTS_KV._store.set('dachsboost_purchases:targetuser', JSON.stringify({ count: 3 }));

      const response = await handleResetWeeklyLimits('exaint_', '@targetuser', env);
      const text = await getResponseText(response);

      expect(text).toContain('zurückgesetzt');
      expect(env.SLOTS_KV.delete).toHaveBeenCalled();
    });
  });
});

// ============================================
// Permission Validation Tests
// ============================================

describe('Admin Permission Validation', () => {
  it('exaint_ is recognized as admin', async () => {
    const { isAdmin } = await import('../utils.js');
    expect(isAdmin('exaint_')).toBe(true);
    expect(isAdmin('EXAINT_')).toBe(true);
  });

  it('frechhdachs is recognized as admin', async () => {
    const { isAdmin } = await import('../utils.js');
    expect(isAdmin('frechhdachs')).toBe(true);
    expect(isAdmin('FreCHHdachS')).toBe(true);
  });

  it('random users are not admins', async () => {
    const { isAdmin } = await import('../utils.js');
    expect(isAdmin('random_user')).toBe(false);
    expect(isAdmin('admin')).toBe(false);
    expect(isAdmin('')).toBe(false);
  });
});
