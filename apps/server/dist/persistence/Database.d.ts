import { IUnitOfWork, IRoomRepository, IGameRepository, ISnapshotRepository, IActionRepository, IReplayRepository } from './interfaces.js';
export declare class Database implements IUnitOfWork {
    private pool;
    readonly rooms: IRoomRepository;
    readonly games: IGameRepository;
    readonly snapshots: ISnapshotRepository;
    readonly actions: IActionRepository;
    readonly replays: IReplayRepository;
    constructor(connectionString: string);
    /**
     * Executes a block of work inside a managed transaction.
     * Exposes repositories bound to the specific transaction client.
     */
    transaction<T>(work: (uow: Omit<IUnitOfWork, 'transaction'>) => Promise<T>): Promise<T>;
    close(): Promise<void>;
}
//# sourceMappingURL=Database.d.ts.map