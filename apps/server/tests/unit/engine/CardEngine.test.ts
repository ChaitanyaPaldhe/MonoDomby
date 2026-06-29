import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CardEngine } from '@monopoly/engine';
import { CardEffectRegistry } from '@monopoly/engine';
import { TileResolver } from '@monopoly/engine';
import { CardEffectType, CardDeckType, EventType, TurnPhase, GamePhase } from '@monopoly/shared';
import type { MapConfig } from '@monopoly/maps';
import type { GameState, ClientAction, CardAppliedEvent } from '@monopoly/shared';;
import { EngineStateCorruptionError } from '@monopoly/engine';

describe('CardEngine', () => {
  let engine: CardEngine;
  let registry: CardEffectRegistry;
  let tileResolver: TileResolver;
  let mockState: GameState;
  let mockMapConfig: MapConfig;
  let mockAction: ClientAction;

  beforeEach(() => {
    registry = new CardEffectRegistry();
    engine = new CardEngine(registry);
    tileResolver = new TileResolver();

    mockAction = {
      actionId: 'test-action-123',
      type: 'APPLY_CARD',
      roomId: 'room-1',
      clientTs: 1000,
      payload: {},
    } as any;

    mockMapConfig = {
      meta: { id: 'test-map' },
      cards: {
        chance: [
          {
            id: 'chance-1',
            text: 'Test Chance Card',
            effect: { type: CardEffectType.COLLECT_FROM_BANK, amount: 100 }
          }
        ],
        communityChest: []
      }
    } as any;

    mockState = {
      id: 'game-1',
      version: 1,
      phase: GamePhase.IN_PROGRESS,
      pendingCard: {
        cardId: 'chance-1',
        deckType: CardDeckType.CHANCE,
        playerId: 'player-1',
        drawSequence: 1,
        timestamp: 1000,
        removedFromDeck: false,
      },
      turn: {
        currentPlayerId: 'player-1',
        phase: TurnPhase.CARD_DRAWN,
      },
      players: {
        'player-1': { money: 1500 }
      }
    } as any;
  });

  it('throws EngineStateCorruptionError if GameState has no pendingCard', () => {
    mockState = { ...mockState, pendingCard: null };
    expect(() => engine.executeCard(mockState, mockAction, mockMapConfig, 'player-1' as any, tileResolver))
      .toThrow(EngineStateCorruptionError);
  });

  it('throws EngineStateCorruptionError if actingPlayerId does not match pendingCard.playerId', () => {
    expect(() => engine.executeCard(mockState, mockAction, mockMapConfig, 'player-2' as any, tileResolver))
      .toThrow(EngineStateCorruptionError);
  });

  it('dispatches to the correct registry handler', () => {
    const mockHandler = vi.fn().mockReturnValue({ newState: mockState, events: [] });
    registry.register(CardEffectType.COLLECT_FROM_BANK, mockHandler);

    engine.executeCard(mockState, mockAction, mockMapConfig, 'player-1' as any, tileResolver);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(
      mockState,
      mockMapConfig.cards.chance[0],
      'player-1',
      mockMapConfig,
      mockAction,
      tileResolver
    );
  });

  it('clears pendingCard and emits CARD_APPLIED after execution', () => {
    const mockHandler = vi.fn().mockReturnValue({
      newState: { ...mockState, someChangedProp: true },
      events: [{ type: 'MOCK_EVENT' }]
    });
    registry.register(CardEffectType.COLLECT_FROM_BANK, mockHandler);

    const result = engine.executeCard(mockState, mockAction, mockMapConfig, 'player-1' as any, tileResolver);

    expect(result.newState.pendingCard).toBeNull();
    expect(result.events.length).toBe(2);
    expect(result.events[0].type).toBe(EventType.CARD_APPLIED);
    expect((result.events[0] as CardAppliedEvent).payload.cardId).toBe('chance-1');
    expect(result.events[1].type).toBe('MOCK_EVENT');
  });

  it('supports custom handlers', () => {
    mockMapConfig.cards.chance[0].effect = { type: CardEffectType.CUSTOM, customHandler: 'my-custom-handler' } as any;

    const customHandler = vi.fn().mockReturnValue({ newState: mockState, events: [] });
    registry.registerCustom('my-custom-handler', customHandler);

    engine.executeCard(mockState, mockAction, mockMapConfig, 'player-1' as any, tileResolver);

    expect(customHandler).toHaveBeenCalledTimes(1);
  });
});
