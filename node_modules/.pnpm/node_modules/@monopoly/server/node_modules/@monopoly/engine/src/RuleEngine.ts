// =============================================================================
// engine/RuleEngine.ts
// Pluggable rule pipeline.
//
// Design:
// - Rules are pure functions registered by ID with an optional priority.
// - After the primary ActionHandler applies a state change, the RuleEngine
//   runs all relevant rules in priority order, accumulating partial state diffs.
// - Rules can be added/removed per map (custom map mechanics) or per game
//   (house rules toggled in GameSettings).
// =============================================================================

import type { GameState } from '@monopoly/shared';
import type { RuleContext, RuleHandler, RegisteredRule } from './types.js';

// ---------------------------------------------------------------------------
// RuleEngine
// ---------------------------------------------------------------------------

/**
 * Registry and executor for pluggable Monopoly rule handlers.
 *
 * Rules are composed in a pipeline and applied after each primary action handler.
 * Each rule receives the current (post-action) state and returns a partial diff.
 * Diffs are shallow-merged sequentially: later rules see earlier rules' changes.
 */
export class RuleEngine {
  private readonly rules: RegisteredRule[] = [];

  // -------------------------------------------------------------------------
  // Registration
  // -------------------------------------------------------------------------

  /**
   * Register a rule handler.
   * Duplicate IDs are replaced (last-write-wins).
   *
   * @param id - Unique rule identifier (e.g., "free-parking-tax").
   * @param handler - Pure rule function.
   * @param priority - Execution order. Lower = earlier. Default: 100.
   */
  register(id: string, handler: RuleHandler, priority = 100): this {
    // Remove existing rule with same ID
    const existingIndex = this.rules.findIndex(r => r.id === id);
    if (existingIndex !== -1) {
      this.rules.splice(existingIndex, 1);
    }

    this.rules.push({ id, priority, handler });
    // Keep sorted by priority ascending
    this.rules.sort((a, b) => a.priority - b.priority);

    return this;
  }

  /**
   * Unregister a rule by ID.
   * No-op if the rule does not exist.
   */
  unregister(id: string): this {
    const index = this.rules.findIndex(r => r.id === id);
    if (index !== -1) {
      this.rules.splice(index, 1);
    }
    return this;
  }

  /**
   * Check whether a rule with the given ID is registered.
   */
  has(id: string): boolean {
    return this.rules.some(r => r.id === id);
  }

  /** Return a snapshot of all registered rule IDs in execution order. */
  getRegisteredIds(): string[] {
    return this.rules.map(r => r.id);
  }

  // -------------------------------------------------------------------------
  // Execution
  // -------------------------------------------------------------------------

  /**
   * Run all registered rules against the current state in priority order.
   *
   * Each rule returns a `Partial<GameState>` diff. Diffs are shallow-merged
   * sequentially so that later rules see the accumulated changes of earlier rules.
   *
   * @param state - Post-action game state (output of ActionHandler).
   * @param context - Rule execution context (who, what tile, config, etc.).
   * @returns New game state with all rule diffs applied.
   */
  applyAll(state: GameState, context: RuleContext): GameState {
    return this.rules.reduce<GameState>(
      (currentState, rule) => {
        const diff = rule.handler(currentState, context);
        // Shallow merge the diff onto the current state
        return { ...currentState, ...diff };
      },
      state,
    );
  }

  /**
   * Run only rules matching a specific tag/ID prefix.
   * Useful for running only "turn-end" rules or "landing" rules.
   *
   * @param prefix - Rule IDs starting with this prefix will be run.
   */
  applyByPrefix(state: GameState, context: RuleContext, prefix: string): GameState {
    return this.rules
      .filter(r => r.id.startsWith(prefix))
      .reduce<GameState>(
        (currentState, rule) => {
          const diff = rule.handler(currentState, context);
          return { ...currentState, ...diff };
        },
        state,
      );
  }

  // -------------------------------------------------------------------------
  // Built-in Rule Stubs
  // These are registered by GameEngine at startup based on MapConfig.rules.
  // ---------------------------------------------------------------------------

  /**
   * TODO: Rule — Award GO reward when player passes GO.
   * Checks if movement path crossed tile index 0.
   * Adjusts player.money and bank.money.
   */
  static readonly RULE_PASS_GO = 'core/pass-go';

  /**
   * TODO: Rule — Free Parking money accumulation.
   * Diverts tax payments to bank.freeParkingPot when enabled.
   * Awards pot to player who lands on Free Parking.
   */
  static readonly RULE_FREE_PARKING = 'house/free-parking';

  /**
   * TODO: Rule — Recompute player netWorth after any asset change.
   * netWorth = money + sum(unmortgaged asset values) + building equity.
   */
  static readonly RULE_RECOMPUTE_NET_WORTH = 'core/net-worth';

  /**
   * TODO: Rule — Verify even-building constraint after house/hotel builds.
   * No property in a group can have more houses than (minInGroup + 1).
   */
  static readonly RULE_EVEN_BUILDING = 'core/even-building';

  /**
   * TODO: Rule — Check for mortgage rent exemption.
   * Rent is not owed on mortgaged properties.
   */
  static readonly RULE_MORTGAGE_RENT_EXEMPTION = 'core/mortgage-rent-exemption';

  /**
   * TODO: Rule — Color-group rent doubling.
   * If a player owns ALL properties in a group with no houses, rent doubles.
   */
  static readonly RULE_COLOR_GROUP_RENT = 'core/color-group-rent';
}
