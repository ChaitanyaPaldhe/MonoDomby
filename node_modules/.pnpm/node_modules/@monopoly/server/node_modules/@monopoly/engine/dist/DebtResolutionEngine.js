import { EventType, DecisionType } from '@monopoly/shared';
;
import { createHash } from 'crypto';
export class DebtResolutionEngine {
    /**
     * Checks if the active player is in DEBT_RECOVERY and has enough cash to settle.
     * If so, settles the debt, clears the pending decision, and emits events.
     * Otherwise, returns the state unchanged.
     */
    static checkAndSettleDebt(state, config, actionId, clientTs) {
        if (state.turn.pendingDecision?.type !== DecisionType.DEBT_RECOVERY) {
            return { newState: state, events: [] };
        }
        const decision = state.turn.pendingDecision;
        const playerId = state.turn.currentPlayerId;
        const player = state.players[playerId];
        if (player.money >= decision.amountOwed) {
            // Settle the debt!
            const newState = { ...state };
            const events = [];
            const updatedPlayer = { ...player, money: player.money - decision.amountOwed };
            newState.players = { ...newState.players, [playerId]: updatedPlayer };
            if (decision.creditorId !== null) {
                const creditor = newState.players[decision.creditorId];
                newState.players = {
                    ...newState.players,
                    [decision.creditorId]: {
                        ...creditor,
                        money: creditor.money + decision.amountOwed
                    }
                };
            }
            else {
                // Owed to bank
                newState.bank = {
                    ...newState.bank,
                    money: newState.bank.money + decision.amountOwed // Bank infinite money handled elsewhere or just ignored here
                };
            }
            // Clear pending decision
            newState.turn = {
                ...newState.turn,
                pendingDecision: null
                // Note: TurnPhase remains whatever it was (usually POST_ROLL or similar)
            };
            events.push({
                id: createHash('sha256').update(`${actionId}:debt-settled:${playerId}`).digest('hex'),
                type: EventType.DEBT_SETTLED,
                roomId: state.roomId,
                gameId: state.id,
                ts: clientTs,
                payload: {
                    playerId,
                    creditorId: decision.creditorId,
                    amount: decision.amountOwed
                },
                audience: { type: 'ALL' }
            });
            events.push({
                id: createHash('sha256').update(`${actionId}:debt-recovery-completed:${playerId}`).digest('hex'),
                type: EventType.DEBT_RECOVERY_COMPLETED,
                roomId: state.roomId,
                gameId: state.id,
                ts: clientTs,
                payload: {
                    playerId
                },
                audience: { type: 'ALL' }
            });
            return { newState: newState, events };
        }
        return { newState: state, events: [] };
    }
}
//# sourceMappingURL=DebtResolutionEngine.js.map