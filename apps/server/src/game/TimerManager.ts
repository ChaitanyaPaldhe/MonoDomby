import { PlayerId, ClientAction, GameState, GameEvent } from '@monopoly/shared';
import { GameEngine } from '@monopoly/engine';
export class TimerManager {
  private timers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Schedules a generic timer.
   * TimerManager has no knowledge of Monopoly rules. It just fires the callback.
   * 
   * @param id Unique identifier for the timer (e.g. 'turn-timeout')
   * @param ms Timeout in milliseconds
   * @param onTimeout Callback executed when timer expires
   */
  public schedule(id: string, ms: number, onTimeout: () => void): void {
    this.cancel(id); // Ensure no duplicate timers
    
    const timeoutId = setTimeout(() => {
      this.timers.delete(id);
      onTimeout();
    }, ms);
    
    this.timers.set(id, timeoutId);
  }

  /**
   * Cancels a previously scheduled timer by ID.
   */
  public cancel(id: string): void {
    const timeoutId = this.timers.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.timers.delete(id);
    }
  }

  /**
   * Cancels all active timers. Useful when destroying a room.
   */
  public cancelAll(): void {
    for (const [id, timeoutId] of this.timers.entries()) {
      clearTimeout(timeoutId);
    }
    this.timers.clear();
  }

  /**
   * Checks if a timer is currently active.
   */
  public isActive(id: string): boolean {
    return this.timers.has(id);
  }
}