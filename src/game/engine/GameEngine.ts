import { useGameStore } from '../../store/gameStore';
import { GameState } from '../../types';

export type GameSpeed = 1 | 2 | 3 | 4;

class GameEngine {
  private lastTime: number = 0;
  private deltaTime: number = 0;
  private readonly TICK_RATE = 60;
  private readonly TICK_INTERVAL = 1000 / this.TICK_RATE;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private gameSpeed: GameSpeed = 1;
  private accumulatedTime: number = 0;
  private readonly FIXED_DT = 1 / 60;

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulatedTime = 0;
    this.gameLoop(this.lastTime);
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  setGameSpeed(speed: GameSpeed) {
    this.gameSpeed = speed;
  }

  getGameSpeed(): GameSpeed {
    return this.gameSpeed;
  }

  private gameLoop = (currentTime: number) => {
    if (!this.isRunning) return;

    this.deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    const store = useGameStore.getState();

    // Read gameSpeed from store instead of being set externally
    this.gameSpeed = store.gameSpeed;

    if (store.gameState === GameState.PLAYING && !store.isPaused) {
      this.accumulatedTime += (this.deltaTime / 1000) * this.gameSpeed;

      const maxSteps = this.gameSpeed * 2;
      let steps = 0;

      while (this.accumulatedTime >= this.FIXED_DT && steps < maxSteps) {
        store.update(this.FIXED_DT);
        this.accumulatedTime -= this.FIXED_DT;
        steps++;
      }

      if (this.accumulatedTime > this.FIXED_DT * 2) {
        this.accumulatedTime = this.FIXED_DT;
      }

      store.updateAI();
    }

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };
}

export const gameEngine = new GameEngine();
