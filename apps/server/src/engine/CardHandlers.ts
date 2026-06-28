import { CardEffectType, EventType, TurnPhase, DecisionType, JailReason } from '@monopoly/shared';
import type { GameState, PlayerId, MapConfig, CardConfig, ClientAction, PendingDecision } from '@monopoly/shared';
import type { EngineResult } from './types.js';
import { EngineNotImplementedError, EngineStateCorruptionError } from './errors.js';
import type { TileResolver } from './TileResolver.js';
import { createHash } from 'node:crypto';
import type { CardMoneyTransferEvent, CardPlayerPaidEvent, CardPlayerReceivedEvent, CardMovedPlayerEvent, PlayerPassedGoEvent, PlayerJailedEvent, CardAddedToInventoryEvent } from '@monopoly/shared';

export function applyCollectFromBank(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult {
  const amount = (card.effect as any).amount;
  if (typeof amount !== 'number') {
    throw new EngineStateCorruptionError(`Card ${card.id} has no amount for COLLECT_FROM_BANK`);
  }
  
  const player = state.players[playerId]!;
  const newState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: { ...player, money: player.money + amount }
    },
    bank: {
      ...state.bank,
      money: config.bank.infiniteMoney ? state.bank.money : state.bank.money - amount },
    turn: {
      ...state.turn,
      phase: TurnPhase.POST_ROLL,
      pendingDecision: null
    }
  };

  const event: CardMoneyTransferEvent = {
    id: createHash('sha256').update(`${action.actionId}:card-money`).digest('hex'),
    type: EventType.CARD_MONEY_TRANSFER,
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

export function applyPayToBank(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult {
  const amount = (card.effect as any).amount;
  if (typeof amount !== 'number') {
    throw new EngineStateCorruptionError(`Card ${card.id} has no amount for PAY_TO_BANK`);
  }
  const player = state.players[playerId]!;

  if (player.money < amount) {
    const pendingDecision: PendingDecision = {
      type: DecisionType.DEBT_RECOVERY,
      creditorId: null,
      amountOwed: amount };
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
      money: state.bank.money + amount },
    turn: {
      ...state.turn,
      phase: TurnPhase.POST_ROLL,
      pendingDecision: null
    }
  };

  const event: CardMoneyTransferEvent = {
    id: createHash('sha256').update(`${action.actionId}:card-money`).digest('hex'),
    type: EventType.CARD_MONEY_TRANSFER,
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

export function applyCollectFromPlayers(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult {
  const amount = (card.effect as any).amount;
  if (typeof amount !== 'number') {
    throw new EngineStateCorruptionError(`Card ${card.id} has no amount for COLLECT_FROM_PLAYERS`);
  }
  
  let newState = { ...state };
  let players = { ...state.players };
  let events = [];

  const otherPlayerIds = Object.keys(players).filter(id => id !== playerId && !players[id as PlayerId]!.isBankrupt);
  
  let totalCollected = 0;
  for (const pid of otherPlayerIds) {
    const p = players[pid as PlayerId]!;
    players[pid as PlayerId] = { ...p, money: p.money - amount } as import('@monopoly/shared').PlayerState;
    totalCollected += amount;

    const event: CardPlayerPaidEvent = {
      id: createHash('sha256').update(`${action.actionId}:paid:${pid}`).digest('hex'),
      type: EventType.CARD_PLAYER_PAID,
      roomId: action.roomId,
      gameId: state.id,
      ts: action.clientTs,
      payload: {
        playerId: pid as PlayerId,
        cardId: card.id,
        payeeIds: [playerId],
        amountPerPlayer: amount },
      audience: { type: 'ALL' }
    };
    events.push(event);
  }

  const p = players[playerId]!;
  players[playerId] = { ...p, money: p.money + totalCollected } as import('@monopoly/shared').PlayerState;

  const receiveEvent: CardPlayerReceivedEvent = {
    id: createHash('sha256').update(`${action.actionId}:received:${playerId}`).digest('hex'),
    type: EventType.CARD_PLAYER_RECEIVED,
    roomId: action.roomId,
    gameId: state.id,
    ts: action.clientTs,
    payload: {
      playerId,
      cardId: card.id,
      payerIds: otherPlayerIds as PlayerId[],
      amountPerPlayer: amount
    },
    audience: { type: 'ALL' }
  };
  events.push(receiveEvent);

  newState.players = players;
  newState.turn = {
    ...newState.turn,
    phase: TurnPhase.POST_ROLL,
    pendingDecision: null
  };

  return { newState, events };
}

export function applyPayToPlayers(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult {
  const amount = (card.effect as any).amount;
  if (typeof amount !== 'number') {
    throw new EngineStateCorruptionError(`Card ${card.id} has no amount for PAY_TO_PLAYERS`);
  }
  
  const otherPlayerIds = Object.keys(state.players).filter(id => id !== playerId && !state.players[id as PlayerId]!.isBankrupt);
  const totalDue = amount * otherPlayerIds.length;
  
  if (state.players[playerId]!.money < totalDue) {
    return {
      newState: {
        ...state,
        turn: {
          ...state.turn,
          pendingDecision: {
            type: DecisionType.DEBT_RECOVERY,
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

  const p = players[playerId]!;
  players[playerId] = { ...p, money: p.money - totalDue } as import('@monopoly/shared').PlayerState;
  
  const paidEvent: CardPlayerPaidEvent = {
    id: createHash('sha256').update(`${action.actionId}:paid:${playerId}`).digest('hex'),
    type: EventType.CARD_PLAYER_PAID,
    roomId: action.roomId,
    gameId: state.id,
    ts: action.clientTs,
    payload: {
      playerId,
      cardId: card.id,
      payeeIds: otherPlayerIds as PlayerId[],
      amountPerPlayer: amount
    },
    audience: { type: 'ALL' }
  };
  events.push(paidEvent);

  for (const pid of otherPlayerIds) {
    const op = players[pid as PlayerId]!;
    players[pid as PlayerId] = { ...op, money: op.money + amount } as import('@monopoly/shared').PlayerState;
    
    const recEvent: CardPlayerReceivedEvent = {
      id: createHash('sha256').update(`${action.actionId}:received:${pid}`).digest('hex'),
      type: EventType.CARD_PLAYER_RECEIVED,
      roomId: action.roomId,
      gameId: state.id,
      ts: action.clientTs,
      payload: {
        playerId: pid as PlayerId,
        cardId: card.id,
        payerIds: [playerId],
        amountPerPlayer: amount },
      audience: { type: 'ALL' }
    };
    events.push(recEvent);
  }

  const newState = {
    ...state,
    players,
    turn: {
      ...state.turn,
      phase: TurnPhase.POST_ROLL,
      pendingDecision: null
    }
  };

  return { newState, events };
}

export function applyMoveToTile(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult {
  const targetTileId = (card.effect as any).targetTileId;
  if (!targetTileId) {
    throw new EngineStateCorruptionError(`Card ${card.id} has no targetTileId for MOVE_TO_TILE`);
  }
  
  const targetIndex = config.board.tiles.findIndex(t => t.id === targetTileId);
  if (targetIndex === -1) {
    throw new EngineStateCorruptionError(`Target tile ${targetTileId} not found in mapConfig`);
  }

  const player = state.players[playerId]!;
  const currentPos = player.position;
  
  let passedGo = false;
  let newMoney = player.money;
  let events = [];

  if (targetIndex < currentPos) {
    passedGo = true;
    newMoney += config.bank.goReward;
    const passGoEvent: PlayerPassedGoEvent = {
      id: createHash('sha256').update(`${action.actionId}:passed-go`).digest('hex'),
      type: EventType.PLAYER_PASSED_GO,
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

  const moveEvent: CardMovedPlayerEvent = {
    id: createHash('sha256').update(`${action.actionId}:card-moved`).digest('hex'),
    type: EventType.CARD_MOVED_PLAYER,
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

export function applyMoveForward(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult {
  const amount = (card.effect as any).amount;
  if (typeof amount !== 'number') {
    throw new EngineStateCorruptionError(`Card ${card.id} has no amount for MOVE_FORWARD`);
  }

  const player = state.players[playerId]!;
  const currentPos = player.position;
  const targetIndex = (currentPos + amount) % config.board.size;
  
  let passedGo = false;
  let newMoney = player.money;
  let events = [];

  if (targetIndex < currentPos) {
    passedGo = true;
    newMoney += config.bank.goReward;
    const passGoEvent: PlayerPassedGoEvent = {
      id: createHash('sha256').update(`${action.actionId}:passed-go`).digest('hex'),
      type: EventType.PLAYER_PASSED_GO,
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

  const moveEvent: CardMovedPlayerEvent = {
    id: createHash('sha256').update(`${action.actionId}:card-moved`).digest('hex'),
    type: EventType.CARD_MOVED_PLAYER,
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

export function applyMoveBackward(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult {
  const amount = (card.effect as any).amount;
  if (typeof amount !== 'number') {
    throw new EngineStateCorruptionError(`Card ${card.id} has no amount for MOVE_BACKWARD`);
  }

  const player = state.players[playerId]!;
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

  const moveEvent: CardMovedPlayerEvent = {
    id: createHash('sha256').update(`${action.actionId}:card-moved`).digest('hex'),
    type: EventType.CARD_MOVED_PLAYER,
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

export function applyMoveToNearest(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult {
  const nearestType = (card.effect as any).nearestType;
  if (!nearestType) {
    throw new EngineStateCorruptionError(`Card ${card.id} has no nearestType for MOVE_TO_NEAREST`);
  }

  const player = state.players[playerId]!;
  const currentPos = player.position;
  
  const targetIndices = config.board.tiles
    .filter(t => t.type === nearestType)
    .map(t => config.board.tiles.findIndex(ti => ti.id === t.id))
    .sort((a, b) => a - b);
    
  if (targetIndices.length === 0) {
    throw new EngineStateCorruptionError(`No tiles of type ${nearestType} found`);
  }

  let targetIndex = targetIndices.find(idx => idx >= currentPos);
  
  let passedGo = false;
  let newMoney = player.money;
  let events = [];

  if (targetIndex === undefined) {
    targetIndex = targetIndices[0];
    passedGo = true;
    newMoney += config.bank.goReward;
    const passGoEvent: PlayerPassedGoEvent = {
      id: createHash('sha256').update(`${action.actionId}:passed-go`).digest('hex'),
      type: EventType.PLAYER_PASSED_GO,
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
      [playerId]: { ...player, position: targetIndex!, money: newMoney } as import('@monopoly/shared').PlayerState
    }
  };

  const moveEvent: CardMovedPlayerEvent = {
    id: createHash('sha256').update(`${action.actionId}:card-moved`).digest('hex'),
    type: EventType.CARD_MOVED_PLAYER,
    roomId: action.roomId,
    gameId: state.id,
    ts: action.clientTs,
    payload: {
      playerId,
      cardId: card.id,
      toPosition: targetIndex!,
      passedGo
    },
    audience: { type: 'ALL' }
  };
  events.push(moveEvent);

  const landingResult = tileResolver.resolve(newState1, targetIndex!, config, action, playerId);
  return {
    newState: landingResult.newState,
    events: [...events, ...landingResult.events]
  };
}

export function applyGoToJail(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult {
  const jailTileIndex = config.board.jailTileIndex;
  
  const newState = {
    ...state,
    players: {
      ...state.players,
      [playerId]: {
        ...state.players[playerId],
        position: jailTileIndex,
        jailState: {
          reason: JailReason.CARD,
          turnsServed: 0,
          jailedAt: action.clientTs
        }
      }
    },
    turn: {
      ...state.turn,
      phase: TurnPhase.POST_ROLL,
      pendingDecision: null
    }
  };

  const jailEvent: PlayerJailedEvent = {
    id: createHash('sha256').update(`${action.actionId}:jailed`).digest('hex'),
    type: EventType.PLAYER_JAILED,
    roomId: action.roomId,
    gameId: state.id,
    ts: action.clientTs,
    payload: {
      playerId,
      reason: JailReason.CARD
    },
    audience: { type: 'ALL' }
  };

  return { newState, events: [jailEvent] };
}

export function applyGetOutOfJailFree(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult {
  const deckType = state.pendingCard!.deckType;
  
  let chanceDiscard = [...state.cardDecks.chanceDiscard];
  let communityChestDiscard = [...state.cardDecks.communityChestDiscard];

  if (deckType === 'CHANCE') {
    chanceDiscard = chanceDiscard.filter(id => id !== card.id);
  } else {
    communityChestDiscard = communityChestDiscard.filter(id => id !== card.id);
  }

  const player = state.players[playerId]!;
  
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
      } as import('@monopoly/shared').PlayerState
    },
    turn: {
      ...state.turn,
      phase: TurnPhase.POST_ROLL,
      pendingDecision: null
    }
  };

  const inventoryEvent: CardAddedToInventoryEvent = {
    id: createHash('sha256').update(`${action.actionId}:jail-card`).digest('hex'),
    type: EventType.CARD_ADDED_TO_INVENTORY,
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

export function applyRepairs(state: GameState, card: CardConfig, playerId: PlayerId, config: MapConfig, action: ClientAction, tileResolver: TileResolver): EngineResult {
  const costPerHouse = (card.effect as any).costPerHouse;
  const costPerHotel = (card.effect as any).costPerHotel;

  if (typeof costPerHouse !== 'number' || typeof costPerHotel !== 'number') {
    throw new EngineStateCorruptionError(`Card ${card.id} missing repair costs`);
  }

  let totalHouses = 0;
  let totalHotels = 0;

  for (const [tileId, tileState] of Object.entries(state.board.tiles)) {
    if (tileState.ownerId === playerId) {
      if (tileState.hasHotel) {
        totalHotels += 1;
      } else {
        totalHouses += tileState.houses;
      }
    }
  }

  const amount = (totalHouses * costPerHouse) + (totalHotels * costPerHotel);
  const player = state.players[playerId]!;

  if (player.money < amount) {
    const pendingDecision: PendingDecision = {
      type: DecisionType.DEBT_RECOVERY,
      creditorId: null,
      amountOwed: amount };
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
      money: state.bank.money + amount },
    turn: {
      ...state.turn,
      phase: TurnPhase.POST_ROLL,
      pendingDecision: null
    }
  };

  let events = [];
  if (amount > 0) {
    const event: CardMoneyTransferEvent = {
      id: createHash('sha256').update(`${action.actionId}:repairs`).digest('hex'),
      type: EventType.CARD_MONEY_TRANSFER,
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
