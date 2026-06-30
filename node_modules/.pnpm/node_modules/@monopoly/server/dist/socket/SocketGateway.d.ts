import { Server, Socket } from 'socket.io';
import { GameService } from '../game/GameService.js';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './SocketEvents.js';
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
/**
 * SocketGateway maps Socket.IO events to GameService method calls and vice-versa.
 * It is completely unaware of Monopoly rules.
 */
export declare class SocketGateway {
    private io;
    private gameService;
    constructor(io: AppServer, gameService: GameService);
    registerHandlers(socket: AppSocket): void;
    /**
     * Wraps socket handlers to catch synchronous exceptions and format them safely.
     */
    private safeExecute;
}
export {};
//# sourceMappingURL=SocketGateway.d.ts.map