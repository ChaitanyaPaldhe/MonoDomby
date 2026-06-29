import { MapConfig } from '@monopoly/maps';
import { GameState, TurnPhase, EventType } from '@monopoly/shared';;
import { BankruptcyStartedEvent, BankruptcyResolvedEvent, PlayerEliminatedEvent } from '@monopoly/shared';
import { BankruptcyPlan } from './BankruptcyPlanner.js';
import { AssetTransferEngine } from './AssetTransferEngine.js';
import { createHash } from 'crypto';

export class BankruptcyEngine {
  public static executeBankruptcyPlan(
    state: GameState,
    plan: BankruptcyPlan,
    config: MapConfig,
    actionId: string,
    clientTs: number
  ): { newState: GameState; events: any[] } {
    let currentState = { ...state };
    const events: any[] = [];
    const playerId = plan.playerId;

    // 1. Emit BANKRUPTCY_STARTED
    events.push({
      id: createHash('sha256').update(`${actionId}:bankruptcy-start:${playerId}`).digest('hex'),
      type: EventType.BANKRUPTCY_STARTED,
      roomId: currentState.roomId,
      gameId: currentState.id,
      ts: clientTs,
      payload: {
        playerId,
        creditorId: plan.creditorId
      },
      audience: { type: 'ALL' }
    } as BankruptcyStartedEvent);

    const player = currentState.players[playerId]!;

    // 2. Transfer cash
    if (player.money > 0) {
      const cashTransfer = player.money;
      currentState.players = {
        ...currentState.players,
        [playerId]: { ...currentState.players[playerId]!, money: 0 }
      };

      if (plan.creditorId !== null) {
        const creditor = currentState.players[plan.creditorId]!;
        currentState.players = {
          ...currentState.players,
          [plan.creditorId]: {
            ...creditor,
            money: creditor.money + cashTransfer
          }
        };
      } else {
        currentState.bank = {
          ...currentState.bank,
          money: currentState.bank.money + cashTransfer
        };
      }
    }

    // 3. Transfer Properties and GOOJF cards via AssetTransferEngine
    const transferResult = AssetTransferEngine.transferAllAssets(
      currentState,
      playerId,
      plan.creditorId,
      actionId,
      clientTs,
      config
    );
    currentState = transferResult.newState;
    events.push(...transferResult.events);

    // 4. Mark player as bankrupt
    currentState.players = {
      ...currentState.players,
      [playerId]: {
        ...currentState.players[playerId]!,
        isBankrupt: true
      }
    };

    events.push({
      id: createHash('sha256').update(`${actionId}:player-eliminated:${playerId}`).digest('hex'),
      type: EventType.PLAYER_ELIMINATED,
      roomId: currentState.roomId,
      gameId: currentState.id,
      ts: clientTs,
      payload: {
        playerId
      },
      audience: { type: 'ALL' }
    } as PlayerEliminatedEvent);

    // 5. Clear pending decision and set turn phase to POST_ROLL (since they are bankrupt, they will end turn soon, or we can just end turn for them).
    // The instructions say "Player remains in GameState but is skipped by TurnState."
    // We can clear pendingDecision and set to POST_ROLL so they can click END_TURN, or the client auto-ends.
    currentState.turn = {
      ...currentState.turn,
      pendingDecision: null,
      phase: TurnPhase.POST_ROLL
    };

    events.push({
      id: createHash('sha256').update(`${actionId}:bankruptcy-resolved:${playerId}`).digest('hex'),
      type: EventType.BANKRUPTCY_RESOLVED,
      roomId: currentState.roomId,
      gameId: currentState.id,
      ts: clientTs,
      payload: {
        playerId
      },
      audience: { type: 'ALL' }
    } as BankruptcyResolvedEvent);

    return { newState: currentState as GameState, events };
  }
}
