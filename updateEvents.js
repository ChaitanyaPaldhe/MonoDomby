const fs = require('fs');
const file = 'd:/Monopoly/packages/shared/src/types/Event.ts';
let content = fs.readFileSync(file, 'utf8');

const payloads = `
export interface DebtRecoveryStartedPayload {
  readonly playerId: PlayerId;
  readonly creditorId: PlayerId | null;
  readonly amountOwed: number;
}

export interface DebtRecoveryCompletedPayload {
  readonly playerId: PlayerId;
}

export interface BankruptcyStartedPayload {
  readonly playerId: PlayerId;
  readonly creditorId: PlayerId | null;
}

export interface BankruptcyResolvedPayload {
  readonly playerId: PlayerId;
}

export interface PlayerEliminatedPayload {
  readonly playerId: PlayerId;
}

export interface PropertyTransferredPayload {
  readonly fromPlayerId: PlayerId;
  readonly toPlayerId: PlayerId | null;
  readonly properties: readonly TileId[];
}

export interface PropertyReturnedToBankPayload {
  readonly fromPlayerId: PlayerId;
  readonly properties: readonly TileId[];
}

export interface DebtSettledPayload {
  readonly playerId: PlayerId;
  readonly creditorId: PlayerId | null;
  readonly amount: number;
}
`;

content = content.replace('// ---------------------------------------------------------------------------\n// Base Event Interface', payloads + '\n// ---------------------------------------------------------------------------\n// Base Event Interface');

const events = `
export type DebtRecoveryStartedEvent = BaseEvent<EventType.DEBT_RECOVERY_STARTED, DebtRecoveryStartedPayload>;
export type DebtRecoveryCompletedEvent = BaseEvent<EventType.DEBT_RECOVERY_COMPLETED, DebtRecoveryCompletedPayload>;
export type BankruptcyStartedEvent = BaseEvent<EventType.BANKRUPTCY_STARTED, BankruptcyStartedPayload>;
export type BankruptcyResolvedEvent = BaseEvent<EventType.BANKRUPTCY_RESOLVED, BankruptcyResolvedPayload>;
export type PlayerEliminatedEvent = BaseEvent<EventType.PLAYER_ELIMINATED, PlayerEliminatedPayload>;
export type PropertyTransferredEvent = BaseEvent<EventType.PROPERTY_TRANSFERRED, PropertyTransferredPayload>;
export type PropertyReturnedToBankEvent = BaseEvent<EventType.PROPERTY_RETURNED_TO_BANK, PropertyReturnedToBankPayload>;
export type DebtSettledEvent = BaseEvent<EventType.DEBT_SETTLED, DebtSettledPayload>;
`;

content = content.replace('export type BankruptcyDeclaredEvent', events + '\nexport type BankruptcyDeclaredEvent');

const union = `
  | DebtRecoveryStartedEvent
  | DebtRecoveryCompletedEvent
  | BankruptcyStartedEvent
  | BankruptcyResolvedEvent
  | PlayerEliminatedEvent
  | PropertyTransferredEvent
  | PropertyReturnedToBankEvent
  | DebtSettledEvent`;

content = content.replace('  | BankruptcyDeclaredEvent', union + '\n  | BankruptcyDeclaredEvent');

fs.writeFileSync(file, content);
