import { describe, it, expect, vi } from 'vitest';
import { sanitizeUsername, validateAmount, kvKey, checkRateLimit, isAdmin, getAdminList, containsProfanity, formatTimeRemaining, safeJsonParse, validateAndCleanTarget } from '../utils.js';

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

describe('isAdmin', () => {
  it('erkennt hardcoded Admins (lowercase)', () => {
    expect(isAdmin('exaint_')).toBe(true);
    expect(isAdmin('frechhdachs')).toBe(true);
  });

  it('erkennt Admins unabhängig von Groß-/Kleinschreibung', () => {
    expect(isAdmin('EXAINT_')).toBe(true);
    expect(isAdmin('FreCHHdachS')).toBe(true);
  });

  it('gibt false für Nicht-Admins zurück', () => {
    expect(isAdmin('random_user')).toBe(false);
    expect(isAdmin('admin')).toBe(false);
  });
});

describe('getAdminList', () => {
  it('gibt Array mit Admin-Usernames zurück', () => {
    const list = getAdminList();
    expect(Array.isArray(list)).toBe(true);
    expect(list).toContain('exaint_');
    expect(list).toContain('frechhdachs');
    expect(list.length).toBe(2);
  });
});

describe('containsProfanity', () => {
  it('erkennt deutsche Schimpfwörter', () => {
    expect(containsProfanity('hurensohn')).toBe(true);
    expect(containsProfanity('wichser')).toBe(true);
    expect(containsProfanity('arschloch')).toBe(true);
  });

  it('erkennt englische Schimpfwörter', () => {
    expect(containsProfanity('fuck')).toBe(true);
    expect(containsProfanity('shit')).toBe(true);
    expect(containsProfanity('bitch')).toBe(true);
  });

  it('erkennt Leetspeak-Varianten', () => {
    expect(containsProfanity('h0rens0hn')).toBe(true);
    expect(containsProfanity('w1chser')).toBe(true);
    expect(containsProfanity('f0ck')).toBe(true);
  });

  it('erkennt Wörter in Sätzen', () => {
    expect(containsProfanity('Du bist ein hurensohn!')).toBe(true);
    expect(containsProfanity('Was für ein scheiß Tag')).toBe(true);
  });

  it('gibt false für sauberen Text zurück', () => {
    expect(containsProfanity('Heute ist ein guter Tag!')).toBe(false);
    expect(containsProfanity('GG gut gespielt')).toBe(false);
    expect(containsProfanity('Viel Glück beim Spielen')).toBe(false);
  });

  it('behandelt leeren/ungültigen Input', () => {
    expect(containsProfanity('')).toBe(false);
    expect(containsProfanity(null)).toBe(false);
    expect(containsProfanity(undefined)).toBe(false);
    expect(containsProfanity(123)).toBe(false);
  });
});

describe('formatTimeRemaining', () => {
  it('formatiert Stunden und Minuten', () => {
    expect(formatTimeRemaining(3600000 + 1800000)).toBe('1h 30m'); // 1.5h
    expect(formatTimeRemaining(7200000 + 900000)).toBe('2h 15m'); // 2h 15m
  });

  it('zeigt nur Minuten bei weniger als 1 Stunde', () => {
    expect(formatTimeRemaining(1800000)).toBe('30m');
    expect(formatTimeRemaining(300000)).toBe('5m');
  });

  it('zeigt 0m für sehr kleine Werte', () => {
    expect(formatTimeRemaining(0)).toBe('0m');
    expect(formatTimeRemaining(30000)).toBe('0m'); // 30 Sekunden
  });

  it('rundet Minuten korrekt ab', () => {
    expect(formatTimeRemaining(90000)).toBe('1m'); // 1.5 Minuten → 1m
  });
});

describe('safeJsonParse', () => {
  it('parst gültiges JSON', () => {
    expect(safeJsonParse('{"key": "value"}')).toEqual({ key: 'value' });
    expect(safeJsonParse('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('gibt Fallback für ungültiges JSON zurück', () => {
    expect(safeJsonParse('invalid')).toBeNull();
    expect(safeJsonParse('invalid', {})).toEqual({});
    expect(safeJsonParse('', [])).toEqual([]);
  });

  it('gibt Fallback für null/undefined zurück', () => {
    expect(safeJsonParse(null)).toBeNull();
    expect(safeJsonParse(undefined, 'default')).toBe('default');
  });
});

describe('validateAndCleanTarget', () => {
  it('validiert und säubert Target mit @', () => {
    const result = validateAndCleanTarget('@TestUser');
    expect(result.error).toBeNull();
    expect(result.cleanTarget).toBe('testuser');
  });

  it('validiert und säubert Target ohne @', () => {
    const result = validateAndCleanTarget('TestUser');
    expect(result.error).toBeNull();
    expect(result.cleanTarget).toBe('testuser');
  });

  it('gibt missing-Error für leeren Target zurück', () => {
    expect(validateAndCleanTarget('').error).toBe('missing');
    expect(validateAndCleanTarget(null).error).toBe('missing');
    expect(validateAndCleanTarget(undefined).error).toBe('missing');
  });

  it('gibt invalid-Error für ungültigen Username zurück', () => {
    expect(validateAndCleanTarget('!!!').error).toBe('invalid');
    expect(validateAndCleanTarget('@').error).toBe('invalid');
  });
});
