import { describe, it, expect, vi } from 'vitest';
import { sanitizeUsername, validateAmount, kvKey, checkRateLimit } from '../utils.js';

describe('sanitizeUsername', () => {
  it('normalisiert Großbuchstaben', () => {
    expect(sanitizeUsername('TestUser')).toBe('testuser');
  });

  it('entfernt Sonderzeichen', () => {
    expect(sanitizeUsername('test@user!')).toBe('testuser');
  });

  it('behält Unterstriche bei', () => {
    expect(sanitizeUsername('test_user')).toBe('test_user');
  });

  it('trimmt Whitespace', () => {
    expect(sanitizeUsername('  testuser  ')).toBe('testuser');
  });

  it('gibt null für leeren String zurück', () => {
    expect(sanitizeUsername('')).toBeNull();
  });

  it('gibt null für null/undefined zurück', () => {
    expect(sanitizeUsername(null)).toBeNull();
    expect(sanitizeUsername(undefined)).toBeNull();
  });

  it('gibt null für Nicht-String zurück', () => {
    expect(sanitizeUsername(123)).toBeNull();
    expect(sanitizeUsername({})).toBeNull();
  });

  it('gibt null für zu langen Username zurück (>25 Zeichen)', () => {
    const longName = 'a'.repeat(26);
    expect(sanitizeUsername(longName)).toBeNull();
  });

  it('akzeptiert Username mit 25 Zeichen', () => {
    const name = 'a'.repeat(25);
    expect(sanitizeUsername(name)).toBe(name);
  });

  it('akzeptiert einzelnes Zeichen', () => {
    expect(sanitizeUsername('a')).toBe('a');
  });

  it('entfernt alle ungültigen Zeichen und prüft Restlänge', () => {
    // Only special chars → empty → null
    expect(sanitizeUsername('!@#$%')).toBeNull();
  });
});

describe('validateAmount', () => {
  it('parst gültige Integer', () => {
    expect(validateAmount('100')).toBe(100);
  });

  it('parst String-Zahlen', () => {
    expect(validateAmount('50')).toBe(50);
  });

  it('gibt null für NaN zurück', () => {
    expect(validateAmount('abc')).toBeNull();
    expect(validateAmount('')).toBeNull();
  });

  it('gibt null für Werte unter Minimum zurück', () => {
    expect(validateAmount('0')).toBeNull();
    expect(validateAmount('-1')).toBeNull();
  });

  it('gibt null für Werte über Maximum zurück', () => {
    expect(validateAmount('100001')).toBeNull();
  });

  it('akzeptiert Grenzwerte (min=1, max=100000)', () => {
    expect(validateAmount('1')).toBe(1);
    expect(validateAmount('100000')).toBe(100000);
  });

  it('respektiert benutzerdefiniertes Minimum', () => {
    expect(validateAmount('5', 10)).toBeNull();
    expect(validateAmount('10', 10)).toBe(10);
  });

  it('respektiert benutzerdefiniertes Maximum', () => {
    expect(validateAmount('500', 1, 100)).toBeNull();
    expect(validateAmount('100', 1, 100)).toBe(100);
  });

  it('schneidet Dezimalstellen ab (parseInt)', () => {
    expect(validateAmount('10.9')).toBe(10);
  });
});

describe('kvKey', () => {
  it('baut einfachen Key mit Prefix + Username', () => {
    expect(kvKey('user:', 'TestUser')).toBe('user:testuser');
  });

  it('hängt zusätzliche Teile mit : an', () => {
    expect(kvKey('buff:', 'User', 'starmagnet')).toBe('buff:user:starmagnet');
  });

  it('mehrere Teile werden mit : getrennt', () => {
    expect(kvKey('stats:', 'User', 'wins', 'total')).toBe('stats:user:wins:total');
  });

  it('wandelt Username immer in Kleinbuchstaben um', () => {
    expect(kvKey('user:', 'UPPERCASE')).toBe('user:uppercase');
  });
});

describe('checkRateLimit', () => {
  function createMockKV() {
    const store = new Map();
    return {
      get: vi.fn(async (key) => store.get(key) || null),
      put: vi.fn(async (key, value) => { store.set(key, value); })
    };
  }

  it('erlaubt Anfragen unter dem Limit', async () => {
    const env = { SLOTS_KV: createMockKV() };
    const result = await checkRateLimit('test:ip', 5, 60, env);
    expect(result).toBe(true);
    expect(env.SLOTS_KV.put).toHaveBeenCalledWith('rl:test:ip', '1', { expirationTtl: 60 });
  });

  it('blockiert Anfragen bei erreichtem Limit', async () => {
    const mockKV = createMockKV();
    mockKV.get.mockResolvedValue('5');
    const env = { SLOTS_KV: mockKV };
    const result = await checkRateLimit('test:ip', 5, 60, env);
    expect(result).toBe(false);
    expect(mockKV.put).not.toHaveBeenCalled();
  });

  it('inkrementiert den Counter korrekt', async () => {
    const mockKV = createMockKV();
    mockKV.get.mockResolvedValue('3');
    const env = { SLOTS_KV: mockKV };
    const result = await checkRateLimit('test:ip', 5, 60, env);
    expect(result).toBe(true);
    expect(mockKV.put).toHaveBeenCalledWith('rl:test:ip', '4', { expirationTtl: 60 });
  });

  it('behandelt fehlenden KV-Eintrag als 0', async () => {
    const env = { SLOTS_KV: createMockKV() };
    const result = await checkRateLimit('new:user', 10, 60, env);
    expect(result).toBe(true);
    expect(env.SLOTS_KV.put).toHaveBeenCalledWith('rl:new:user', '1', { expirationTtl: 60 });
  });
});
