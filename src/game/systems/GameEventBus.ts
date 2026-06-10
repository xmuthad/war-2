export type GameEventType =
  | 'unit:attack'
  | 'unit:destroyed'
  | 'unit:move'
  | 'unit:produced'
  | 'unit:promoted'
  | 'unit:teleport'
  | 'unit:deployStart'
  | 'unit:deployed'
  | 'ui:notification'
  | 'building:constructed'
  | 'building:destroyed'
  | 'building:damaged'
  | 'resource:collected'
  | 'resource:deposited'
  | 'resource:depleted'
  | 'combat:hit'
  | 'combat:explosion'
  | 'combat:emp'
  | 'combat:projectile'
  | 'game:victory'
  | 'game:defeat'
  | 'alert:lowPower'
  | 'alert:baseUnderAttack'
  | 'power:low'
  | 'power:restored'
  | 'terrain:tilesChanged'
  | 'upgrade:completed'
  | 'upgrade:started'
  | 'transport:load'
  | 'transport:unload'
  | 'superweapon:activated'
  | 'superweapon:charging'
  | 'superweapon:launch'
  | 'bridge:destroyed'
  | 'bridge:repaired'
  | 'pathfinding:obstaclesChanged'
  | 'map:ping'
  | 'map:reveal'
  | 'camera:centerOn'
  | 'sound:play'
  | 'settings:volumeChanged'
  | 'radiation:deploy'
  | 'nuclear:explosion'
  | 'notification:info'
  | 'notification:warning'
  | 'notification:danger'
  | 'notification:success'
  | 'notification:special';

export interface GameEvent {
  type: GameEventType;
  data?: Record<string, unknown>;
  timestamp: number;
}

export type GameEventHandler = (event: GameEvent) => void;

class GameEventBus {
  private handlers: Map<GameEventType, Set<GameEventHandler>> = new Map();
  private anyHandlers: Set<GameEventHandler> = new Set();
  private eventQueue: GameEvent[] = [];
  private maxQueueSize = 200;

  on(eventType: GameEventType, handler: GameEventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);

    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }

  onAny(handler: GameEventHandler): () => void {
    this.anyHandlers.add(handler);
    return () => {
      this.anyHandlers.delete(handler);
    };
  }

  emit(eventType: GameEventType, data?: Record<string, unknown>): void {
    const event: GameEvent = {
      type: eventType,
      data,
      timestamp: Date.now(),
    };

    this.eventQueue.push(event);
    if (this.eventQueue.length > this.maxQueueSize) {
      this.eventQueue.shift();
    }

    const handlers = this.handlers.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      }
    }

    // Notify onAny subscribers
    for (const handler of this.anyHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in onAny handler for ${eventType}:`, error);
      }
    }
  }

  getRecentEvents(count: number = 10): GameEvent[] {
    return this.eventQueue.slice(-count);
  }

  clear(): void {
    this.eventQueue = [];
  }

  dispose(): void {
    this.handlers.clear();
    this.eventQueue = [];
  }
}

export const gameEventBus = new GameEventBus();

// Expose to window for E2E tests to subscribe to and verify event flow.
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__GAME_EVENT_BUS__ = gameEventBus;
}
