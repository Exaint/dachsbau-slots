import { describe, it, expect } from 'vitest';
import { calculateWin } from '../commands/slots/engine.js';

describe('calculateWin', () => {
  // === Dachs Payouts ===
  describe('Dachs', () => {
    it('Triple Dachs = 15000', () => {
      const result = calculateWin(['🦡', '🦡', '🦡']);
      expect(result.points).toBe(15000);
    });

    it('Doppel Dachs = 2500', () => {
      const result = calculateWin(['🦡', '🦡', '⭐']);
      expect(result.points).toBe(2500);
    });

    it('Single Dachs = 100', () => {
      const result = calculateWin(['🦡', '⭐', '🍉']);
      expect(result.points).toBe(100);
    });
  });

  // === Diamond Free Spins ===
  describe('Diamonds', () => {
    it('Triple Diamant = 5 Free Spins, 0 Punkte', () => {
      const result = calculateWin(['💎', '💎', '💎']);
      expect(result.points).toBe(0);
      expect(result.freeSpins).toBe(5);
    });

    it('Doppel Diamant = 1 Free Spin', () => {
      const result = calculateWin(['💎', '💎', '⭐']);
      expect(result.points).toBe(0);
      expect(result.freeSpins).toBe(1);
    });

    it('Doppel Diamant (nicht-adjazent) = 1 Free Spin', () => {
      const result = calculateWin(['💎', '⭐', '💎']);
      expect(result.points).toBe(0);
      expect(result.freeSpins).toBe(1);
    });
  });

  // === Symbol Triples ===
  describe('Triples', () => {
    it('Triple ⭐ = 500', () => {
      expect(calculateWin(['⭐', '⭐', '⭐']).points).toBe(500);
    });

    it('Triple 🍉 = 250', () => {
      expect(calculateWin(['🍉', '🍉', '🍉']).points).toBe(250);
    });

    it('Triple 🍇 = 150', () => {
      expect(calculateWin(['🍇', '🍇', '🍇']).points).toBe(150);
    });

    it('Triple 🍊 = 100', () => {
      expect(calculateWin(['🍊', '🍊', '🍊']).points).toBe(100);
    });

    it('Triple 🍋 = 75', () => {
      expect(calculateWin(['🍋', '🍋', '🍋']).points).toBe(75);
    });

    it('Triple 🍒 = 50', () => {
      expect(calculateWin(['🍒', '🍒', '🍒']).points).toBe(50);
    });
  });

  // === Symbol Pairs ===
  describe('Pairs (adjazent)', () => {
    it('Paar ⭐ (links) = 50', () => {
      expect(calculateWin(['⭐', '⭐', '🍒']).points).toBe(50);
    });

    it('Paar ⭐ (rechts) = 50', () => {
      expect(calculateWin(['🍒', '⭐', '⭐']).points).toBe(50);
    });

    it('Paar 🍉 = 25', () => {
      expect(calculateWin(['🍉', '🍉', '🍒']).points).toBe(25);
    });

    it('Paar 🍇 = 15', () => {
      expect(calculateWin(['🍇', '🍇', '🍒']).points).toBe(15);
    });

    it('Paar 🍊 = 10', () => {
      expect(calculateWin(['🍊', '🍊', '🍒']).points).toBe(10);
    });

    it('Paar 🍋 = 8', () => {
      expect(calculateWin(['🍋', '🍋', '🍒']).points).toBe(8);
    });

    it('Paar 🍒 = 5', () => {
      expect(calculateWin(['🍒', '🍒', '🍋']).points).toBe(5);
    });

    it('Nicht-adjazentes Paar zählt nicht als Gewinn', () => {
      // e.g. ['⭐', '🍒', '⭐'] → neither pair nor triple
      const result = calculateWin(['⭐', '🍒', '⭐']);
      expect(result.points).toBe(0);
      expect(result.freeSpins).toBeUndefined();
    });
  });

  // === Loss ===
  describe('Verlust', () => {
    it('Keine Übereinstimmung = 0 Punkte', () => {
      const result = calculateWin(['⭐', '🍉', '🍒']);
      expect(result.points).toBe(0);
      expect(result.freeSpins).toBeUndefined();
      expect(result.message).toBeTruthy();
    });
  });

  // === Wild Card ===
  describe('Wild Card (🃏)', () => {
    it('3 Wilds = Star Triple (500)', () => {
      const result = calculateWin(['🃏', '🃏', '🃏']);
      expect(result.points).toBe(500);
    });

    it('2 Wilds + Symbol = Triple des Symbols', () => {
      const result = calculateWin(['🃏', '🃏', '🍒']);
      expect(result.points).toBe(50); // Cherry Triple
    });

    it('2 Wilds + 🦡 = Triple Dachs (15000)', () => {
      const result = calculateWin(['🃏', '🃏', '🦡']);
      expect(result.points).toBe(15000);
    });

    it('1 Wild + Paar = Triple', () => {
      const result = calculateWin(['🃏', '🍉', '🍉']);
      expect(result.points).toBe(250); // Watermelon Triple
    });

    it('1 Wild + verschiedene Symbole = Paar mit höherem Wert', () => {
      // ⭐ pair=50, 🍒 pair=5 → wild makes ⭐ pair
      const result = calculateWin(['🃏', '⭐', '🍒']);
      expect(result.points).toBe(50); // Star Pair
    });

    it('Wild zählt nicht für Diamant Free Spins', () => {
      // Only real diamonds count for free spins
      const result = calculateWin(['🃏', '💎', '💎']);
      // 2 real diamonds = 1 free spin (diamond check uses original grid)
      expect(result.freeSpins).toBe(1);
    });
  });
});
