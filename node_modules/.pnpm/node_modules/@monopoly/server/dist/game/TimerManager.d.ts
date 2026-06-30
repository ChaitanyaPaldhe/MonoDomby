export declare class TimerManager {
    private timers;
    /**
     * Schedules a generic timer.
     * TimerManager has no knowledge of Monopoly rules. It just fires the callback.
     *
     * @param id Unique identifier for the timer (e.g. 'turn-timeout')
     * @param ms Timeout in milliseconds
     * @param onTimeout Callback executed when timer expires
     */
    schedule(id: string, ms: number, onTimeout: () => void): void;
    /**
     * Cancels a previously scheduled timer by ID.
     */
    cancel(id: string): void;
    /**
     * Cancels all active timers. Useful when destroying a room.
     */
    cancelAll(): void;
    /**
     * Checks if a timer is currently active.
     */
    isActive(id: string): boolean;
}
//# sourceMappingURL=TimerManager.d.ts.map