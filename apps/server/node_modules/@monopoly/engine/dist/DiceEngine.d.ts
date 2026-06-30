import type { RNGState } from '@monopoly/shared';
export interface DiceRollResult {
    /** Individual die values. */
    readonly dice: readonly [number, number];
    /** Sum of both dice. */
    readonly total: number;
    readonly isDoubles: boolean;
    /** Updated PRNG state. Must replace GameState.rngState. */
    readonly nextRngState: RNGState;
}
/**
 * Deterministic dice roller.
 * All methods are static — no instance state. The RNGState flows through GameState.
 */
export declare class DiceEngine {
    /** Dice face count. Standard 6-sided dice. */
    private static readonly FACES;
    /**
     * Create a new RNGState from a seed string.
     * The seed is hashed to 4 × 32-bit words using a simple splitmix32 expansion.
     *
     * @param seed - Hex string from crypto.randomBytes(32).toString('hex') at game start.
     * @param gameId - Game ID mixed in for uniqueness even if seeds collide.
     */
    static createRNGState(seed: string, gameId: string): RNGState;
    /**
     * Roll two 6-sided dice.
     * Advances the PRNG state twice (once per die).
     *
     * @param rngState - Current RNG state from GameState.
     * @returns DiceRollResult containing values and the next RNG state to persist.
     */
    static rollTwoDice(rngState: RNGState): DiceRollResult;
    /**
     * Roll a single N-sided die.
     * @internal
     */
    static rollOneDie(rngState: RNGState, faces?: number): [number, RNGState];
    /**
     * Shuffle an array using the Fisher-Yates algorithm driven by the PRNG.
     * Used by CardEngine to shuffle decks.
     *
     * @returns [shuffledArray, nextRngState]
     */
    static shuffle<T>(items: readonly T[], rngState: RNGState): [T[], RNGState];
    /**
     * Get raw PRNG output without mapping to a dice range.
     * @internal
     */
    private static rollRaw;
    /**
     * Deterministic hash of a string to 4 × uint32 words.
     * Uses a simplified splitmix32 expansion — not cryptographic, just for seeding.
     * @internal
     */
    private static hashToWords;
}
//# sourceMappingURL=DiceEngine.d.ts.map