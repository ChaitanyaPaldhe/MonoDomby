import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { GameService } from '../game/GameService.js';
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData } from './SocketEvents.js';
import { authenticationMiddleware, loggingMiddleware, payloadValidationMiddleware } from './SocketMiddleware.js';
import { SocketGateway } from './SocketGateway.js';

type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export class SocketServer {
  private io: AppServer;
  private gateway: SocketGateway;

  constructor(
    httpServer: HttpServer,
    gameService: GameService,
    corsOrigins: string[] = ['*']
  ) {
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
  public getServer(): AppServer {
    return this.io;
  }

  /**
   * Graceful shutdown of socket connections
   */
  public close(): void {
    this.io.close();
  }
}
