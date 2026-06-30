import { Server } from 'socket.io';
import { authenticationMiddleware, loggingMiddleware, payloadValidationMiddleware } from './SocketMiddleware.js';
import { SocketGateway } from './SocketGateway.js';
export class SocketServer {
    io;
    gateway;
    constructor(httpServer, gameService, corsOrigins = ['*']) {
        this.io = new Server(httpServer, {
            cors: {
                origin: corsOrigins,
                methods: ['GET', 'POST']
            }
        });
        // Register Middlewares
        this.io.use(loggingMiddleware);
        this.io.use(authenticationMiddleware);
        // Initialize the gateway
        this.gateway = new SocketGateway(this.io, gameService);
        // Register Global Connection Handler
        this.io.on('connection', (socket) => {
            // Apply payload validation per-socket
            payloadValidationMiddleware(socket);
            // Register event handlers
            this.gateway.registerHandlers(socket);
        });
    }
    /**
     * Returns the underlying configured socket.io server instance
     */
    getServer() {
        return this.io;
    }
    /**
     * Graceful shutdown of socket connections
     */
    close() {
        this.io.close();
    }
}
//# sourceMappingURL=SocketServer.js.map