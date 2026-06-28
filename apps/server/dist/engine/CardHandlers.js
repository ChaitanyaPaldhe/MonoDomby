"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCollectFromBank = applyCollectFromBank;
exports.applyPayToBank = applyPayToBank;
exports.applyCollectFromPlayers = applyCollectFromPlayers;
exports.applyPayToPlayers = applyPayToPlayers;
exports.applyMoveToTile = applyMoveToTile;
exports.applyMoveForward = applyMoveForward;
exports.applyMoveBackward = applyMoveBackward;
exports.applyMoveToNearest = applyMoveToNearest;
exports.applyGoToJail = applyGoToJail;
exports.applyGetOutOfJailFree = applyGetOutOfJailFree;
exports.applyRepairs = applyRepairs;
const shared_1 = require("@monopoly/shared");
const errors_js_1 = require("./errors.js");
const node_crypto_1 = require("node:crypto");
function applyCollectFromBank(state, card, playerId, config, action, tileResolver) {
    const amount = card.effect.amount;
    if (typeof amount !== 'number') {
        throw new errors_js_1.EngineStateCorruptionError(`Card ${card.id} has no amount for COLLECT_FROM_BANK`);
    }
    const player = state.players[playerId];
    const newState = {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, money: player.money + amount }
        },
        bank: {
            ...state.bank,
            money: config.bank.infiniteMoney ? state.bank.money : state.bank.money - amount
        },
        turn: {
            ...state.turn,
            phase: shared_1.TurnPhase.POST_ROLL,
            pendingDecision: null
        }
    };
    const event = {
        id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:card-money`).digest('hex'),
        type: shared_1.EventType.CARD_MONEY_TRANSFER,
        roomId: action.roomId,
        gameId: state.id,
        ts: action.clientTs,
        payload: {
            playerId,
            cardId: card.id,
            amount,
            toBank: false
        },
        audience: { type: 'ALL' }
    };
    return { newState, events: [event] };
}
function applyPayToBank(state, card, playerId, config, action, tileResolver) {
    const amount = card.effect.amount;
    if (typeof amount !== 'number') {
        throw new errors_js_1.EngineStateCorruptionError(`Card ${card.id} has no amount for PAY_TO_BANK`);
    }
    const player = state.players[playerId];
    if (player.money < amount) {
        const pendingDecision = {
            type: shared_1.DecisionType.DEBT_RECOVERY,
            creditorId: null,
            amountOwed: amount
        };
        return {
            newState: {
                ...state,
                turn: { ...state.turn, pendingDecision }
            },
            events: []
        };
    }
    const newState = {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, money: player.money - amount }
        },
        bank: {
            ...state.bank,
            money: state.bank.money + amount
        },
        turn: {
            ...state.turn,
            phase: shared_1.TurnPhase.POST_ROLL,
            pendingDecision: null
        }
    };
    const event = {
        id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:card-money`).digest('hex'),
        type: shared_1.EventType.CARD_MONEY_TRANSFER,
        roomId: action.roomId,
        gameId: state.id,
        ts: action.clientTs,
        payload: {
            playerId,
            cardId: card.id,
            amount,
            toBank: true
        },
        audience: { type: 'ALL' }
    };
    return { newState, events: [event] };
}
function applyCollectFromPlayers(state, card, playerId, config, action, tileResolver) {
    const amount = card.effect.amount;
    if (typeof amount !== 'number') {
        throw new errors_js_1.EngineStateCorruptionError(`Card ${card.id} has no amount for COLLECT_FROM_PLAYERS`);
    }
    let newState = { ...state };
    let players = { ...state.players };
    let events = [];
    const otherPlayerIds = Object.keys(players).filter(id => id !== playerId && !players[id].isBankrupt);
    let totalCollected = 0;
    for (const pid of otherPlayerIds) {
        const p = players[pid];
        players[pid] = { ...p, money: p.money - amount };
        totalCollected += amount;
        const event = {
            id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:paid:${pid}`).digest('hex'),
            type: shared_1.EventType.CARD_PLAYER_PAID,
            roomId: action.roomId,
            gameId: state.id,
            ts: action.clientTs,
            payload: {
                playerId: pid,
                cardId: card.id,
                payeeIds: [playerId],
                amountPerPlayer: amount
            },
            audience: { type: 'ALL' }
        };
        events.push(event);
    }
    const p = players[playerId];
    players[playerId] = { ...p, money: p.money + totalCollected };
    const receiveEvent = {
        id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:received:${playerId}`).digest('hex'),
        type: shared_1.EventType.CARD_PLAYER_RECEIVED,
        roomId: action.roomId,
        gameId: state.id,
        ts: action.clientTs,
        payload: {
            playerId,
            cardId: card.id,
            payerIds: otherPlayerIds,
            amountPerPlayer: amount
        },
        audience: { type: 'ALL' }
    };
    events.push(receiveEvent);
    newState.players = players;
    newState.turn = {
        ...newState.turn,
        phase: shared_1.TurnPhase.POST_ROLL,
        pendingDecision: null
    };
    return { newState, events };
}
function applyPayToPlayers(state, card, playerId, config, action, tileResolver) {
    const amount = card.effect.amount;
    if (typeof amount !== 'number') {
        throw new errors_js_1.EngineStateCorruptionError(`Card ${card.id} has no amount for PAY_TO_PLAYERS`);
    }
    const otherPlayerIds = Object.keys(state.players).filter(id => id !== playerId && !state.players[id].isBankrupt);
    const totalDue = amount * otherPlayerIds.length;
    if (state.players[playerId].money < totalDue) {
        return {
            newState: {
                ...state,
                turn: {
                    ...state.turn,
                    pendingDecision: {
                        type: shared_1.DecisionType.DEBT_RECOVERY,
                        creditorId: null,
                        amountOwed: totalDue
                    }
                }
            },
            events: []
        };
    }
    let players = { ...state.players };
    let events = [];
    const p = players[playerId];
    players[playerId] = { ...p, money: p.money - totalDue };
    const paidEvent = {
        id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:paid:${playerId}`).digest('hex'),
        type: shared_1.EventType.CARD_PLAYER_PAID,
        roomId: action.roomId,
        gameId: state.id,
        ts: action.clientTs,
        payload: {
            playerId,
            cardId: card.id,
            payeeIds: otherPlayerIds,
            amountPerPlayer: amount
        },
        audience: { type: 'ALL' }
    };
    events.push(paidEvent);
    for (const pid of otherPlayerIds) {
        const op = players[pid];
        players[pid] = { ...op, money: op.money + amount };
        const recEvent = {
            id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:received:${pid}`).digest('hex'),
            type: shared_1.EventType.CARD_PLAYER_RECEIVED,
            roomId: action.roomId,
            gameId: state.id,
            ts: action.clientTs,
            payload: {
                playerId: pid,
                cardId: card.id,
                payerIds: [playerId],
                amountPerPlayer: amount
            },
            audience: { type: 'ALL' }
        };
        events.push(recEvent);
    }
    const newState = {
        ...state,
        players,
        turn: {
            ...state.turn,
            phase: shared_1.TurnPhase.POST_ROLL,
            pendingDecision: null
        }
    };
    return { newState, events };
}
function applyMoveToTile(state, card, playerId, config, action, tileResolver) {
    const targetTileId = card.effect.targetTileId;
    if (!targetTileId) {
        throw new errors_js_1.EngineStateCorruptionError(`Card ${card.id} has no targetTileId for MOVE_TO_TILE`);
    }
    const targetIndex = config.board.tiles.findIndex(t => t.id === targetTileId);
    if (targetIndex === -1) {
        throw new errors_js_1.EngineStateCorruptionError(`Target tile ${targetTileId} not found in mapConfig`);
    }
    const player = state.players[playerId];
    const currentPos = player.position;
    let passedGo = false;
    let newMoney = player.money;
    let events = [];
    if (targetIndex < currentPos) {
        passedGo = true;
        newMoney += config.bank.goReward;
        const passGoEvent = {
            id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:passed-go`).digest('hex'),
            type: shared_1.EventType.PLAYER_PASSED_GO,
            roomId: action.roomId,
            gameId: state.id,
            ts: action.clientTs,
            payload: {
                playerId,
                amount: config.bank.goReward
            },
            audience: { type: 'ALL' }
        };
        events.push(passGoEvent);
    }
    const newState1 = {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, position: targetIndex, money: newMoney }
        }
    };
    const moveEvent = {
        id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:card-moved`).digest('hex'),
        type: shared_1.EventType.CARD_MOVED_PLAYER,
        roomId: action.roomId,
        gameId: state.id,
        ts: action.clientTs,
        payload: {
            playerId,
            cardId: card.id,
            toPosition: targetIndex,
            passedGo
        },
        audience: { type: 'ALL' }
    };
    events.push(moveEvent);
    const landingResult = tileResolver.resolve(newState1, targetIndex, config, action, playerId);
    return {
        newState: landingResult.newState,
        events: [...events, ...landingResult.events]
    };
}
function applyMoveForward(state, card, playerId, config, action, tileResolver) {
    const amount = card.effect.amount;
    if (typeof amount !== 'number') {
        throw new errors_js_1.EngineStateCorruptionError(`Card ${card.id} has no amount for MOVE_FORWARD`);
    }
    const player = state.players[playerId];
    const currentPos = player.position;
    const targetIndex = (currentPos + amount) % config.board.size;
    let passedGo = false;
    let newMoney = player.money;
    let events = [];
    if (targetIndex < currentPos) {
        passedGo = true;
        newMoney += config.bank.goReward;
        const passGoEvent = {
            id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:passed-go`).digest('hex'),
            type: shared_1.EventType.PLAYER_PASSED_GO,
            roomId: action.roomId,
            gameId: state.id,
            ts: action.clientTs,
            payload: {
                playerId,
                amount: config.bank.goReward
            },
            audience: { type: 'ALL' }
        };
        events.push(passGoEvent);
    }
    const newState1 = {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, position: targetIndex, money: newMoney }
        }
    };
    const moveEvent = {
        id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:card-moved`).digest('hex'),
        type: shared_1.EventType.CARD_MOVED_PLAYER,
        roomId: action.roomId,
        gameId: state.id,
        ts: action.clientTs,
        payload: {
            playerId,
            cardId: card.id,
            toPosition: targetIndex,
            passedGo
        },
        audience: { type: 'ALL' }
    };
    events.push(moveEvent);
    const landingResult = tileResolver.resolve(newState1, targetIndex, config, action, playerId);
    return {
        newState: landingResult.newState,
        events: [...events, ...landingResult.events]
    };
}
function applyMoveBackward(state, card, playerId, config, action, tileResolver) {
    const amount = card.effect.amount;
    if (typeof amount !== 'number') {
        throw new errors_js_1.EngineStateCorruptionError(`Card ${card.id} has no amount for MOVE_BACKWARD`);
    }
    const player = state.players[playerId];
    const currentPos = player.position;
    let targetIndex = currentPos - amount;
    if (targetIndex < 0) {
        targetIndex += config.board.size;
    }
    let events = [];
    const newState1 = {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, position: targetIndex }
        }
    };
    const moveEvent = {
        id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:card-moved`).digest('hex'),
        type: shared_1.EventType.CARD_MOVED_PLAYER,
        roomId: action.roomId,
        gameId: state.id,
        ts: action.clientTs,
        payload: {
            playerId,
            cardId: card.id,
            toPosition: targetIndex,
            passedGo: false
        },
        audience: { type: 'ALL' }
    };
    events.push(moveEvent);
    const landingResult = tileResolver.resolve(newState1, targetIndex, config, action, playerId);
    return {
        newState: landingResult.newState,
        events: [...events, ...landingResult.events]
    };
}
function applyMoveToNearest(state, card, playerId, config, action, tileResolver) {
    const nearestType = card.effect.nearestType;
    if (!nearestType) {
        throw new errors_js_1.EngineStateCorruptionError(`Card ${card.id} has no nearestType for MOVE_TO_NEAREST`);
    }
    const player = state.players[playerId];
    const currentPos = player.position;
    const targetIndices = config.board.tiles
        .filter(t => t.type === nearestType)
        .map(t => config.board.tiles.findIndex(ti => ti.id === t.id))
        .sort((a, b) => a - b);
    if (targetIndices.length === 0) {
        throw new errors_js_1.EngineStateCorruptionError(`No tiles of type ${nearestType} found`);
    }
    let targetIndex = targetIndices.find(idx => idx >= currentPos);
    let passedGo = false;
    let newMoney = player.money;
    let events = [];
    if (targetIndex === undefined) {
        targetIndex = targetIndices[0];
        passedGo = true;
        newMoney += config.bank.goReward;
        const passGoEvent = {
            id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:passed-go`).digest('hex'),
            type: shared_1.EventType.PLAYER_PASSED_GO,
            roomId: action.roomId,
            gameId: state.id,
            ts: action.clientTs,
            payload: {
                playerId,
                amount: config.bank.goReward
            },
            audience: { type: 'ALL' }
        };
        events.push(passGoEvent);
    }
    const newState1 = {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, position: targetIndex, money: newMoney }
        }
    };
    const moveEvent = {
        id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:card-moved`).digest('hex'),
        type: shared_1.EventType.CARD_MOVED_PLAYER,
        roomId: action.roomId,
        gameId: state.id,
        ts: action.clientTs,
        payload: {
            playerId,
            cardId: card.id,
            toPosition: targetIndex,
            passedGo
        },
        audience: { type: 'ALL' }
    };
    events.push(moveEvent);
    const landingResult = tileResolver.resolve(newState1, targetIndex, config, action, playerId);
    return {
        newState: landingResult.newState,
        events: [...events, ...landingResult.events]
    };
}
function applyGoToJail(state, card, playerId, config, action, tileResolver) {
    const jailTileIndex = config.board.jailTileIndex;
    const newState = {
        ...state,
        players: {
            ...state.players,
            [playerId]: {
                ...state.players[playerId],
                position: jailTileIndex,
                jailState: {
                    reason: shared_1.JailReason.CARD,
                    turnsServed: 0,
                    jailedAt: action.clientTs
                }
            }
        },
        turn: {
            ...state.turn,
            phase: shared_1.TurnPhase.POST_ROLL,
            pendingDecision: null
        }
    };
    const jailEvent = {
        id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:jailed`).digest('hex'),
        type: shared_1.EventType.PLAYER_JAILED,
        roomId: action.roomId,
        gameId: state.id,
        ts: action.clientTs,
        payload: {
            playerId,
            reason: shared_1.JailReason.CARD
        },
        audience: { type: 'ALL' }
    };
    return { newState, events: [jailEvent] };
}
function applyGetOutOfJailFree(state, card, playerId, config, action, tileResolver) {
    const deckType = state.pendingCard.deckType;
    let chanceDiscard = [...state.cardDecks.chanceDiscard];
    let communityChestDiscard = [...state.cardDecks.communityChestDiscard];
    if (deckType === 'CHANCE') {
        chanceDiscard = chanceDiscard.filter(id => id !== card.id);
    }
    else {
        communityChestDiscard = communityChestDiscard.filter(id => id !== card.id);
    }
    const player = state.players[playerId];
    const newState = {
        ...state,
        cardDecks: {
            ...state.cardDecks,
            chanceDiscard,
            communityChestDiscard
        },
        players: {
            ...state.players,
            [playerId]: {
                ...player,
                getOutOfJailCards: player.getOutOfJailCards + 1
            }
        },
        turn: {
            ...state.turn,
            phase: shared_1.TurnPhase.POST_ROLL,
            pendingDecision: null
        }
    };
    const inventoryEvent = {
        id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:jail-card`).digest('hex'),
        type: shared_1.EventType.CARD_ADDED_TO_INVENTORY,
        roomId: action.roomId,
        gameId: state.id,
        ts: action.clientTs,
        payload: {
            playerId,
            cardId: card.id
        },
        audience: { type: 'ALL' }
    };
    return { newState, events: [inventoryEvent] };
}
function applyRepairs(state, card, playerId, config, action, tileResolver) {
    const costPerHouse = card.effect.costPerHouse;
    const costPerHotel = card.effect.costPerHotel;
    if (typeof costPerHouse !== 'number' || typeof costPerHotel !== 'number') {
        throw new errors_js_1.EngineStateCorruptionError(`Card ${card.id} missing repair costs`);
    }
    let totalHouses = 0;
    let totalHotels = 0;
    for (const [tileId, tileState] of Object.entries(state.board.tiles)) {
        if (tileState.ownerId === playerId) {
            if (tileState.hasHotel) {
                totalHotels += 1;
            }
            else {
                totalHouses += tileState.houses;
            }
        }
    }
    const amount = (totalHouses * costPerHouse) + (totalHotels * costPerHotel);
    const player = state.players[playerId];
    if (player.money < amount) {
        const pendingDecision = {
            type: shared_1.DecisionType.DEBT_RECOVERY,
            creditorId: null,
            amountOwed: amount
        };
        return {
            newState: {
                ...state,
                turn: { ...state.turn, pendingDecision }
            },
            events: []
        };
    }
    const newState = {
        ...state,
        players: {
            ...state.players,
            [playerId]: { ...player, money: player.money - amount }
        },
        bank: {
            ...state.bank,
            money: state.bank.money + amount
        },
        turn: {
            ...state.turn,
            phase: shared_1.TurnPhase.POST_ROLL,
            pendingDecision: null
        }
    };
    let events = [];
    if (amount > 0) {
        const event = {
            id: (0, node_crypto_1.createHash)('sha256').update(`${action.actionId}:repairs`).digest('hex'),
            type: shared_1.EventType.CARD_MONEY_TRANSFER,
            roomId: action.roomId,
            gameId: state.id,
            ts: action.clientTs,
            payload: {
                playerId,
                cardId: card.id,
                amount,
                toBank: true
            },
            audience: { type: 'ALL' }
        };
        events.push(event);
    }
    return { newState, events };
}
//# sourceMappingURL=CardHandlers.js.map