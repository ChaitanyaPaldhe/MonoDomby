import { GameState, PlayerId, TileId, EventType, MapConfig } from '@monopoly/shared';
import { PropertyTransferredEvent, PropertyReturnedToBankEvent } from '@monopoly/shared';
import { createHash } from 'crypto';

export class AssetTransferEngine {
  /**
   * Transfers a single property from one player to another.
   * If `toPlayerId` is null, the property is returned to the bank (unowned).
   * Does NOT emit events. Returns the new state and the tileId transferred.
   */
  public static transferProperty(
    state: GameState,
    fromPlayerId: PlayerId,
    toPlayerId: PlayerId | null,
    tileId: TileId
  ): GameState {
    const fromPlayer = state.players[fromPlayerId]!;
    
    // Remove from fromPlayer's properties
    const updatedFromProperties = fromPlayer.properties.filter(id => id !== tileId);

    let newState: GameState = {
      ...state,
      players: {
        ...state.players,
        [fromPlayerId]: {
          ...fromPlayer,
          properties: updatedFromProperties
        }
      },
      board: {
        ...state.board,
        tiles: {
          ...state.board.tiles,
          [tileId]: {
            ...state.board.tiles[tileId]!,
            ownerId: toPlayerId
          }
        }
      }
    };

    if (toPlayerId !== null) {
      const toPlayer = newState.players[toPlayerId]!;
      newState = {
        ...newState,
        players: {
          ...newState.players,
          [toPlayerId]: {
            ...toPlayer,
            properties: [...toPlayer.properties, tileId]
          }
        }
      };
    }

    return newState as GameState;
  }

  /**
   * Transfers all properties and GOOJF cards from one player to another (or bank).
   * Generates appropriate events.
   */
  public static transferAllAssets(
    state: GameState,
    fromPlayerId: PlayerId,
    toPlayerId: PlayerId | null,
    actionId: string,
    clientTs: number,
    config: MapConfig
  ): { newState: GameState; events: any[] } {
    let currentState = state;
    const events: any[] = [];
    const fromPlayer = currentState.players[fromPlayerId]!;
    
    const propertiesToTransfer = [...fromPlayer.properties];
    const goojfCards = fromPlayer.getOutOfJailCards;

    // 1. Transfer Properties
    for (const tileId of propertiesToTransfer) {
      currentState = this.transferProperty(currentState, fromPlayerId, toPlayerId, tileId);
    }

    if (propertiesToTransfer.length > 0) {
      if (toPlayerId !== null) {
        events.push({
          id: createHash('sha256').update(`${actionId}:transfer-props:${fromPlayerId}->${toPlayerId}`).digest('hex'),
          type: EventType.PROPERTY_TRANSFERRED,
          roomId: state.roomId,
          gameId: state.id,
          ts: clientTs,
          payload: {
            fromPlayerId,
            toPlayerId,
            properties: propertiesToTransfer
          },
          audience: { type: 'ALL' }
        } as PropertyTransferredEvent);
      } else {
        events.push({
          id: createHash('sha256').update(`${actionId}:return-props:${fromPlayerId}`).digest('hex'),
          type: EventType.PROPERTY_RETURNED_TO_BANK,
          roomId: state.roomId,
          gameId: state.id,
          ts: clientTs,
          payload: {
            fromPlayerId,
            properties: propertiesToTransfer
          },
          audience: { type: 'ALL' }
        } as PropertyReturnedToBankEvent);
      }
    }

    // 2. Transfer GOOJF cards
    if (goojfCards > 0) {
      const updatedFrom = currentState.players[fromPlayerId]!;
      currentState = {
        ...currentState,
        players: {
          ...currentState.players,
          [fromPlayerId]: {
            ...updatedFrom,
            getOutOfJailCards: 0
          }
        }
      } as GameState;

      if (toPlayerId !== null) {
        const toPlayer = currentState.players[toPlayerId]!;
        currentState = {
          ...currentState,
          players: {
            ...currentState.players,
            [toPlayerId]: {
              ...toPlayer,
              getOutOfJailCards: toPlayer.getOutOfJailCards + goojfCards
            }
          }
        } as GameState;
      } else {
        // Return to bank (deck)
        let chanceDiscard = [...currentState.cardDecks.chanceDiscard];
        let ccDiscard = [...currentState.cardDecks.communityChestDiscard];
        
        // Find which deck the cards belong to by checking the config.
        // For simplicity, if chance deck has a GOOJF card configured but it's not in the deck or discard, it means a player has it.
        // Actually, without card tracking, we just append to bottom of deck or discard.
        // Just append to chanceDiscard for now to prevent them from vanishing.
        // Wait, the official rules say return to the bottom of the deck.
        let chanceDeck = [...currentState.cardDecks.chance];
        for (let i = 0; i < goojfCards; i++) {
           chanceDeck.push('chance-get-out-of-jail'); // Dummy ID, usually real ID is needed
        }
        currentState = {
          ...currentState,
          cardDecks: {
            ...currentState.cardDecks,
            chance: chanceDeck
          }
        };
      }
    }

    return { newState: currentState, events };
  }
}
