import type { GameState } from '@monopoly/shared';
import type { RuleContext, RuleHandler } from './types.js';
/**
 * Registry and executor for pluggable Monopoly rule handlers.
 *
 * Rules are composed in a pipeline and applied after each primary action handler.
 * Each rule receives the current (post-action) state and returns a partial diff.
 * Diffs are shallow-merged sequentially: later rules see earlier rules' changes.
 */
export declare class RuleEngine {
    private readonly rules;
    /**
     * Register a rule handler.
     * Duplicate IDs are replaced (last-write-wins).
     *
     * @param id - Unique rule identifier (e.g., "free-parking-tax").
     * @param handler - Pure rule function.
     * @param priority - Execution order. Lower = earlier. Default: 100.
     */
    register(id: string, handler: RuleHandler, priority?: number): this;
    /**
     * Unregister a rule by ID.
     * No-op if the rule does not exist.
     */
    unregister(id: string): this;
    /**
     * Check whether a rule with the given ID is registered.
     */
    has(id: string): boolean;
    /** Return a snapshot of all registered rule IDs in execution order. */
    getRegisteredIds(): string[];
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
    applyAll(state: GameState, context: RuleContext): GameState;
    /**
     * Run only rules matching a specific tag/ID prefix.
     * Useful for running only "turn-end" rules or "landing" rules.
     *
     * @param prefix - Rule IDs starting with this prefix will be run.
     */
    applyByPrefix(state: GameState, context: RuleContext, prefix: string): GameState;
    /**
     * TODO: Rule — Award GO reward when player passes GO.
     * Checks if movement path crossed tile index 0.
     * Adjusts player.money and bank.money.
     */
    static readonly RULE_PASS_GO = "core/pass-go";
    /**
     * TODO: Rule — Free Parking money accumulation.
     * Diverts tax payments to bank.freeParkingPot when enabled.
     * Awards pot to player who lands on Free Parking.
     */
    static readonly RULE_FREE_PARKING = "house/free-parking";
    /**
     * TODO: Rule — Recompute player netWorth after any asset change.
     * netWorth = money + sum(unmortgaged asset values) + building equity.
     */
    static readonly RULE_RECOMPUTE_NET_WORTH = "core/net-worth";
    /**
     * TODO: Rule — Verify even-building constraint after house/hotel builds.
     * No property in a group can have more houses than (minInGroup + 1).
     */
    static readonly RULE_EVEN_BUILDING = "core/even-building";
    /**
     * TODO: Rule — Check for mortgage rent exemption.
     * Rent is not owed on mortgaged properties.
     */
    static readonly RULE_MORTGAGE_RENT_EXEMPTION = "core/mortgage-rent-exemption";
    /**
     * TODO: Rule — Color-group rent doubling.
     * If a player owns ALL properties in a group with no houses, rent doubles.
     */
    static readonly RULE_COLOR_GROUP_RENT = "core/color-group-rent";
}
//# sourceMappingURL=RuleEngine.d.ts.map