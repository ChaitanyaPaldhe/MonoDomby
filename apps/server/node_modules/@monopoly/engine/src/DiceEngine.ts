// =============================================================================
// engine/DiceEngine.ts
// Server-side deterministic dice generation using xoshiro256++.
//
// Design:
// - ALL dice are generated server-side. Clients never influence dice values.
// - The PRNG state is stored in GameState.rngState for full replay support.
// - Given the same RNGState, the sequence of rolls is always identical.
// - The engine never calls Math.random().
// =============================================================================

import type { RNGState } from '@monopoly/shared';

// ---------------------------------------------------------------------------
// Dice Roll Result
// ---------------------------------------------------------------------------

export interface DiceRollResult {
  /** Individual die values. */
  readonly dice: readonly [number, number];
  /** Sum of both dice. */
  readonly total: number;
  readonly isDoubles: boolean;
  /** Updated PRNG state. Must replace GameState.rngState. */
  readonly nextRngState: RNGState;
}

// ---------------------------------------------------------------------------
// xoshiro256++ Implementation
// ---------------------------------------------------------------------------

/**
 * xoshiro256++ PRNG — a fast, high-quality 64-bit PRNG.
 * We use 32-bit arithmetic split across two 32-bit numbers for JS compatibility.
 *
 * Reference: https://prng.di.unimi.it/xoshiro256plusplus.c
 *
 * @internal
 */
function rotl32(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0;
}

/**
 * Advance the xoshiro256++ state by one step and return the next output.
 * All arithmetic is kept in unsigned 32-bit integer space.
 *
 * @returns [output, nextS0, nextS1, nextS2, nextS3]
 * @internal
 */
function xoshiro256ppNext(
  s0: number,
  s1: number,
  s2: number,
  s3: number,
): [number, number, number, number, number] {
  const result = (rotl32((s0 + s3) >>> 0, 7) + s0) >>> 0;
  const t = (s1 << 17) >>> 0;

  const ns2 = (s2 ^ s0) >>> 0;
  const ns3 = (s3 ^ s1) >>> 0;
  const ns1 = (s1 ^ ns2) >>> 0;
  const ns0 = (s0 ^ ns3) >>> 0;
  const ns2b = (ns2 ^ t) >>> 0;
  const ns3b = rotl32(ns3, 45);

  return [result, ns0, ns1, ns2b, ns3b];
}

// ---------------------------------------------------------------------------
// DiceEngine
// ---------------------------------------------------------------------------

/**
 * Deterministic dice roller.
 * All methods are static — no instance state. The RNGState flows through GameState.
 */
export class DiceEngine {
  /** Dice face count. Standard 6-sided dice. */
  private static readonly FACES = 6;

  // -------------------------------------------------------------------------
  // Initialisation
  // -------------------------------------------------------------------------

  /**
   * Create a new RNGState from a seed string.
   * The seed is hashed to 4 × 32-bit words using a simple splitmix32 expansion.
   *
   * @param seed - Hex string from crypto.randomBytes(32).toString('hex') at game start.
   * @param gameId - Game ID mixed in for uniqueness even if seeds collide.
   */
  static createRNGState(seed: string, gameId: string): RNGState {
    // Use the seed + gameId to produce 4 independent 32-bit seed values
    const combined = `${seed}:${gameId}`;
    const words = DiceEngine.hashToWords(combined);

    return {
      seed,
      s0: words[0] ?? 0x12345678,
      s1: words[1] ?? 0x9abcdef0,
      s2: words[2] ?? 0xfedcba98,
      s3: words[3] ?? 0x76543210,
      counter: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Dice Rolling
  // -------------------------------------------------------------------------

  /**
   * Roll two 6-sided dice.
   * Advances the PRNG state twice (once per die).
   *
   * @param rngState - Current RNG state from GameState.
   * @returns DiceRollResult containing values and the next RNG state to persist.
   */
  static rollTwoDice(rngState: RNGState): DiceRollResult {
    const [die1, nextState1] = DiceEngine.rollOneDie(rngState);
    const [die2, nextState2] = DiceEngine.rollOneDie(nextState1);

    return {
      dice: [die1, die2],
      total: die1 + die2,
      isDoubles: die1 === die2,
      nextRngState: nextState2,
    };
  }

  /**
   * Roll a single N-sided die.
   * @internal
   */
  static rollOneDie(rngState: RNGState, faces: number = DiceEngine.FACES): [number, RNGState] {
    const [output, ns0, ns1, ns2, ns3] = xoshiro256ppNext(
      rngState.s0,
      rngState.s1,
      rngState.s2,
      rngState.s3,
    );

    // Map output to [1, faces] range
    const value = (output % faces) + 1;

    const nextState: RNGState = {
      seed: rngState.seed,
      s0: ns0,
      s1: ns1,
      s2: ns2,
      s3: ns3,
      counter: rngState.counter + 1,
    };

    return [value, nextState];
  }

  /**
   * Shuffle an array using the Fisher-Yates algorithm driven by the PRNG.
   * Used by CardEngine to shuffle decks.
   *
   * @returns [shuffledArray, nextRngState]
   */
  static shuffle<T>(items: readonly T[], rngState: RNGState): [T[], RNGState] {
    const arr = [...items];
    let currentState = rngState;

    for (let i = arr.length - 1; i > 0; i--) {
      // Roll a random index in [0, i]
      const [raw, nextState] = DiceEngine.rollRaw(currentState);
      currentState = nextState;
      const j = raw % (i + 1);

      // Swap
      const temp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = temp;
    }

    return [arr, currentState];
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /**
   * Get raw PRNG output without mapping to a dice range.
   * @internal
   */
  private static rollRaw(rngState: RNGState): [number, RNGState] {
    const [output, ns0, ns1, ns2, ns3] = xoshiro256ppNext(
      rngState.s0,
      rngState.s1,
      rngState.s2,
      rngState.s3,
    );

    return [
      output >>> 0,
      {
        seed: rngState.seed,
        s0: ns0,
        s1: ns1,
        s2: ns2,
        s3: ns3,
        counter: rngState.counter + 1,
      },
    ];
  }

  /**
   * Deterministic hash of a string to 4 × uint32 words.
   * Uses a simplified splitmix32 expansion — not cryptographic, just for seeding.
   * @internal
   */
  private static hashToWords(input: string): [number, number, number, number] {
    let h = 0x811c9dc5; // FNV-1a offset basis
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193); // FNV prime
      h >>>= 0;
    }

    // Splitmix32 expansion from h
    const next = (x: number): number => {
      x = Math.imul((x ^ (x >>> 16)), 0x45d9f3b) >>> 0;
      x = Math.imul((x ^ (x >>> 16)), 0x45d9f3b) >>> 0;
      return (x ^ (x >>> 16)) >>> 0;
    };

    const w0 = next(h);
    const w1 = next(w0);
    const w2 = next(w1);
    const w3 = next(w2);

    return [w0, w1, w2, w3];
  }
}
