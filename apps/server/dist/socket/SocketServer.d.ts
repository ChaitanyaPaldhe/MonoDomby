import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { GameService } from '../game/GameService.js';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './SocketEvents.js';
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export declare class SocketServer {
    private io;
    private gateway;
    constructor(httpServer: HttpServer, gameService: GameService, corsOrigins?: string[]);
    /**
     * Returns the underlying configured socket.io server instance
     */
    getServer(): AppServer;
    /**
     * Graceful shutdown of socket connections
     */
    close(): void;
}
export {};
//# sourceMappingURL=SocketServer.d.ts.map