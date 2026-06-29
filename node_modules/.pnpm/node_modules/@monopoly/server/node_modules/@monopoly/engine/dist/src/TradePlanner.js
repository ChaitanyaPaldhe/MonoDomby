"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradePlanner = void 0;
const errors_js_1 = require("./errors.js");
const MortgageEngine_js_1 = require("./MortgageEngine.js");
class TradePlanner {
    static validateTradeOffer(offer, state, playerId, config) {
        const player = state.players[playerId];
        if (!player)
            throw new errors_js_1.EngineValidationError('Player not found', ErrorCode.E_INVALID_ACTION);
        // 1. Money
        if (offer.money > player.money) {
            throw new errors_js_1.EngineValidationError('Cannot offer more money than owned', ErrorCode.E_INVALID_ACTION);
        }
        if (offer.money < 0) {
            throw new errors_js_1.EngineValidationError('Cannot offer negative money', ErrorCode.E_INVALID_ACTION);
        }
        // 2. Jail cards
        if (offer.jailCards > player.getOutOfJailCards) {
            throw new errors_js_1.EngineValidationError('Cannot offer more jail cards than owned', ErrorCode.E_INVALID_ACTION);
        }
        if (offer.jailCards < 0) {
            throw new errors_js_1.EngineValidationError('Cannot offer negative jail cards', ErrorCode.E_INVALID_ACTION);
        }
        // 3. Properties
        for (const tileId of offer.properties) {
            if (!player.properties.includes(tileId)) {
                throw new errors_js_1.EngineValidationError(`Player does not own property ${tileId}`, ErrorCode.E_PROPERTY_NOT_OWNED);
            }
            const ts = state.board.tiles[tileId];
            if (ts && (ts.houses > 0 || ts.hasHotel)) {
                throw new errors_js_1.EngineValidationError('Cannot trade property with buildings', ErrorCode.E_INVALID_ACTION);
            }
            // 4. Color group buildings check
            const tileDef = config.board.tiles.find(t => t.id === tileId);
            if (tileDef?.propertyData) {
                const groupId = tileDef.propertyData.groupId;
                const groupTiles = config.board.tiles.filter(t => t.propertyData?.groupId === groupId);
                for (const t of groupTiles) {
                    const groupTs = state.board.tiles[t.id];
                    if (groupTs && (groupTs.houses > 0 || groupTs.hasHotel)) {
                        throw new errors_js_1.EngineValidationError('Cannot trade property while buildings exist in its color group', ErrorCode.E_INVALID_ACTION);
                    }
                }
            }
        }
    }
    static planTradeProposal(state, config, initiatorId, targetId, offer, request, tradeId, currentTurn) {
        if (initiatorId === targetId) {
            throw new errors_js_1.EngineValidationError('Cannot trade with yourself', ErrorCode.E_INVALID_ACTION);
        }
        this.validateTradeOffer(offer, state, initiatorId, config);
        this.validateTradeOffer(request, state, targetId, config);
        return {
            id: tradeId,
            initiatorId,
            targetId,
            offer,
            request,
            status: TradeStatus.PENDING,
            createdTurn: currentTurn,
            expiresTurn: currentTurn + 5 // Arbitrary 5 turn limit, could be configured
        };
    }
    static planTradeExecution(state, config, trade) {
        // Re-validate that ownership hasn't changed since proposal
        this.validateTradeOffer(trade.offer, state, trade.initiatorId, config);
        this.validateTradeOffer(trade.request, state, trade.targetId, config);
        const initiator = state.players[trade.initiatorId];
        const target = state.players[trade.targetId];
        // 10% Mortgage Transfer Fees
        // Initiator receives 'request.properties' from Target.
        const initiatorMortgageFee = MortgageEngine_js_1.MortgageEngine.calculateTransferFees(state, config, trade.request.properties);
        // Target receives 'offer.properties' from Initiator.
        const targetMortgageFee = MortgageEngine_js_1.MortgageEngine.calculateTransferFees(state, config, trade.offer.properties);
        // Calculate net cash change
        // Initiator gives offer.money, receives request.money, pays initiatorMortgageFee
        const initiatorNetChange = trade.request.money - trade.offer.money - initiatorMortgageFee;
        // Target gives request.money, receives offer.money, pays targetMortgageFee
        const targetNetChange = trade.offer.money - trade.request.money - targetMortgageFee;
        const bankMoneyChange = initiatorMortgageFee + targetMortgageFee;
        const requiredDebtRecoveryPlans = [];
        // Check if either player is driven into negative balance
        let finalInitiatorMoneyChange = initiatorNetChange;
        if (initiator.money + initiatorNetChange < 0) {
            const shortfall = -(initiator.money + initiatorNetChange);
            finalInitiatorMoneyChange = -initiator.money; // Takes all their money
            requiredDebtRecoveryPlans.push({
                playerId: trade.initiatorId,
                amountOwed: shortfall,
                creditorId: null // Mortgage fee is owed to the bank
            });
        }
        let finalTargetMoneyChange = targetNetChange;
        if (target.money + targetNetChange < 0) {
            const shortfall = -(target.money + targetNetChange);
            finalTargetMoneyChange = -target.money;
            requiredDebtRecoveryPlans.push({
                playerId: trade.targetId,
                amountOwed: shortfall,
                creditorId: null
            });
        }
        if (requiredDebtRecoveryPlans.length > 1) {
            // It is impossible for BOTH players to go into debt because a trade always results
            // in one side gaining money or they both just pay mortgage fees. If BOTH players
            // pay mortgage fees AND both go into debt, our engine only supports one pending decision at a time.
            // So we reject the trade entirely.
            throw new errors_js_1.EngineValidationError('Trade rejected: Both players would enter Debt Recovery due to mortgage fees, which is unsupported simultaneously.', ErrorCode.E_INVALID_ACTION);
        }
        // Additional constraint: The active player MUST be the one who resolves debt if there is one.
        // If a player who is NOT the current player enters DebtRecovery, we reject the trade because
        // it would break the turn sequence (only current player can have a pendingDecision).
        if (requiredDebtRecoveryPlans.length === 1) {
            const debtPlayerId = requiredDebtRecoveryPlans[0].playerId;
            if (debtPlayerId !== state.turn.currentPlayerId) {
                throw new errors_js_1.EngineValidationError('Trade rejected: Trade would cause non-active player to enter Debt Recovery, which cannot be resolved off-turn.', ErrorCode.E_INVALID_ACTION);
            }
        }
        return {
            tradeId: trade.id,
            initiatorId: trade.initiatorId,
            targetId: trade.targetId,
            finalTrade: {
                ...trade,
                status: TradeStatus.ACCEPTED
            },
            initiatorMoneyChange: finalInitiatorMoneyChange,
            targetMoneyChange: finalTargetMoneyChange,
            bankMoneyChange,
            requiredDebtRecoveryPlans
        };
    }
}
exports.TradePlanner = TradePlanner;
//# sourceMappingURL=TradePlanner.js.map