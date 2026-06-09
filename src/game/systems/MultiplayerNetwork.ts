import { gameEventBus } from './GameEventBus';

export enum NetworkMessageType {
  JOIN_ROOM = 'JOIN_ROOM',
  LEAVE_ROOM = 'LEAVE_ROOM',
  PLAYER_JOINED = 'PLAYER_JOINED',
  PLAYER_LEFT = 'PLAYER_LEFT',
  GAME_START = 'GAME_START',
  GAME_STATE_SYNC = 'GAME_STATE_SYNC',
  GAME_COMMAND = 'GAME_COMMAND',
  UNIT_MOVE = 'UNIT_MOVE',
  UNIT_ATTACK = 'UNIT_ATTACK',
  UNIT_PRODUCE = 'UNIT_PRODUCE',
  BUILDING_PLACE = 'BUILDING_PLACE',
  BUILDING_SELL = 'BUILDING_SELL',
  CHAT = 'CHAT',
  PING = 'PING',
  PONG = 'PONG',
  ERROR = 'ERROR',
  DISCONNECT = 'DISCONNECT',
}

export interface NetworkMessage {
  type: string;
  roomId?: string;
  playerId?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export interface GameCommand {
  type: string;
  playerId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

class MultiplayerNetwork {
  ws: WebSocket | null = null;
  roomId: string | null = null;
  playerId: string;
  isConnected: boolean = false;
  isHost: boolean = false;
  latency: number = 0;
  messageQueue: NetworkMessage[] = [];
  handlers: Map<string, Set<Function>> = new Map();

  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private lastPingTimestamp: number = 0;

  constructor() {
    this.playerId = this.generatePlayerId();
  }

  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  connect(serverUrl: string): void {
    if (this.ws) {
      this.disconnect();
    }

    this.ws = new WebSocket(serverUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
      this.emit('network:connected');
      this.startPingLoop();
      this.processMessageQueue();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message: NetworkMessage = JSON.parse(event.data as string);
        this.routeMessage(message);
      } catch (error) {
        console.error('Failed to parse network message:', error);
      }
    };

    this.ws.onclose = () => {
      this.isConnected = false;
      this.stopPingLoop();
      this.emit('network:disconnected');
    };

    this.ws.onerror = (event: Event) => {
      this.emit('network:error', { error: event });
    };
  }

  disconnect(): void {
    this.stopPingLoop();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    this.roomId = null;
    this.isHost = false;
  }

  createRoom(playerName: string, faction: string): void {
    this.isHost = true;
    const message: NetworkMessage = {
      type: NetworkMessageType.JOIN_ROOM,
      playerId: this.playerId,
      data: { playerName, faction, isHost: true },
      timestamp: Date.now(),
    };
    this.send(message);
  }

  joinRoom(roomId: string, playerName: string, faction: string): void {
    this.isHost = false;
    this.roomId = roomId;
    const message: NetworkMessage = {
      type: NetworkMessageType.JOIN_ROOM,
      roomId,
      playerId: this.playerId,
      data: { playerName, faction, isHost: false },
      timestamp: Date.now(),
    };
    this.send(message);
  }

  leaveRoom(): void {
    if (!this.roomId) return;
    const message: NetworkMessage = {
      type: NetworkMessageType.LEAVE_ROOM,
      roomId: this.roomId,
      playerId: this.playerId,
      timestamp: Date.now(),
    };
    this.send(message);
    this.roomId = null;
    this.isHost = false;
  }

  sendCommand(command: GameCommand): void {
    const message: NetworkMessage = {
      type: NetworkMessageType.GAME_COMMAND,
      roomId: this.roomId ?? undefined,
      playerId: this.playerId,
      data: command as unknown as Record<string, unknown>,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  sendGameState(state: object): void {
    if (!this.isHost) return;
    const message: NetworkMessage = {
      type: NetworkMessageType.GAME_STATE_SYNC,
      roomId: this.roomId ?? undefined,
      playerId: this.playerId,
      data: state as Record<string, unknown>,
      timestamp: Date.now(),
    };
    this.send(message);
  }

  on(event: string, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
  }

  off(event: string, handler: Function): void {
    this.handlers.get(event)?.delete(handler);
  }

  private emit(event: string, data?: Record<string, unknown>): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in network handler for ${event}:`, error);
        }
      }
    }

    // Also bridge relevant events to the game event bus
    if (event.startsWith('network:')) {
      gameEventBus.emit(event as any, data);
    }
  }

  private send(message: NetworkMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  private routeMessage(message: NetworkMessage): void {
    switch (message.type) {
      case NetworkMessageType.PLAYER_JOINED:
        this.emit('network:playerJoined', message.data);
        break;

      case NetworkMessageType.PLAYER_LEFT:
        this.emit('network:playerLeft', message.data);
        break;

      case NetworkMessageType.GAME_START:
        this.emit('network:gameStart', message.data);
        break;

      case NetworkMessageType.GAME_STATE_SYNC:
        this.emit('network:gameStateSync', message.data);
        break;

      case NetworkMessageType.GAME_COMMAND:
        this.emit('network:gameCommand', message.data);
        break;

      case NetworkMessageType.PONG:
        this.latency = Date.now() - this.lastPingTimestamp;
        this.emit('network:latency', { latency: this.latency });
        break;

      case NetworkMessageType.CHAT:
        this.emit('network:chat', message.data);
        break;

      case NetworkMessageType.ERROR:
        this.emit('network:error', message.data);
        break;

      case NetworkMessageType.DISCONNECT:
        this.emit('network:playerDisconnected', message.data);
        break;

      default:
        // Route unit/building specific commands through the generic game command handler
        if (
          message.type === NetworkMessageType.UNIT_MOVE ||
          message.type === NetworkMessageType.UNIT_ATTACK ||
          message.type === NetworkMessageType.UNIT_PRODUCE ||
          message.type === NetworkMessageType.BUILDING_PLACE ||
          message.type === NetworkMessageType.BUILDING_SELL
        ) {
          this.emit('network:gameCommand', {
            ...message.data,
            commandType: message.type,
          });
        }
        break;
    }
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingTimestamp = Date.now();
        const message: NetworkMessage = {
          type: NetworkMessageType.PING,
          roomId: this.roomId ?? undefined,
          playerId: this.playerId,
          timestamp: this.lastPingTimestamp,
        };
        this.ws.send(JSON.stringify(message));
      }
    }, 2000);
  }

  private stopPingLoop(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private processMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()!;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message));
      } else {
        // Connection lost again, put message back and stop
        this.messageQueue.unshift(message);
        break;
      }
    }
  }
}

export const multiplayerNetwork = new MultiplayerNetwork();
