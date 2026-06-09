import { Player, UnitState, Difficulty } from '../../types';
import { GAME_CONFIG } from '../config/GameConfig';
import { AI_CONFIG } from '../config/AIConfig';

function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

interface AttackWaveState {
  cooldownTimer: number;
  lastWaveSize: number;
  waveCount: number;
}

export class AttackWaveSystem {
  private readonly MIN_WAVE_SIZE = 2;
  private readonly WAVE_COOLDOWN = 12; // seconds between waves (was 20)
  private readonly INITIAL_DELAY = 8;  // first wave kicks in earlier (was 15)
  private readonly WAVE_REQUIREMENT_RATIO = 0.45; // send 45% of combat units
  private states = new Map<string, AttackWaveState>();

  reset(): void {
    this.states.clear();
  }

  update(aiPlayer: Player, allPlayers: Player[], deltaTime: number, difficulty: Difficulty = Difficulty.NORMAL): void {
    // Initialize state
    let state = this.states.get(aiPlayer.id);
    if (!state) {
      state = { cooldownTimer: this.INITIAL_DELAY, lastWaveSize: 0, waveCount: 0 };
      this.states.set(aiPlayer.id, state);
    }

    // Get difficulty multipliers
    const diffKey = (difficulty as string).toLowerCase();
    const freqMult = AI_CONFIG.WAVE_FREQUENCY[diffKey as keyof typeof AI_CONFIG.WAVE_FREQUENCY] || 1;
    const sizeRatio = AI_CONFIG.WAVE_SIZE_RATIO[diffKey as keyof typeof AI_CONFIG.WAVE_SIZE_RATIO] || 0.4;
    const minSize = AI_CONFIG.WAVE_MIN_SIZE[diffKey as keyof typeof AI_CONFIG.WAVE_MIN_SIZE] || 3;

    // Tick cooldown (apply frequency multiplier to make cooldown tick faster)
    state.cooldownTimer -= deltaTime * freqMult;
    if (state.cooldownTimer > 0) return;

    // Find enemy
    const enemy = allPlayers.find(p => p.id !== aiPlayer.id && !p.isDefeated);
    if (!enemy) return;

    // Get available combat units
    const combatUnits = aiPlayer.units.filter(u =>
      u.data.attack > 0 &&
      (u.state === UnitState.IDLE || u.state === UnitState.GUARDING) &&
      u.health > u.maxHealth * 0.4
    );

    if (combatUnits.length < minSize) return;

    // Select wave: send up to sizeRatio of combat units
    const waveSize = Math.max(
      minSize,
      Math.floor(combatUnits.length * sizeRatio)
    );
    const wave = combatUnits.slice(-waveSize); // take from the end for variety

    // Find primary target (prefer enemy command center, then nearest building, then nearest unit)
    let target: { x: number; y: number; id: string } | null = null;
    const enemyCommand = enemy.buildings.find(b => b.type === 'command' && b.isConstructed);
    if (enemyCommand) {
      target = {
        x: enemyCommand.position.x + GAME_CONFIG.TILE_SIZE,
        y: enemyCommand.position.y + GAME_CONFIG.TILE_SIZE,
        id: enemyCommand.id
      };
    } else {
      // Fall back to nearest building
      let nearest: typeof target = null;
      let nearestDist = Infinity;
      for (const b of enemy.buildings.filter(b => b.isConstructed)) {
        const cx = b.position.x + (b.data?.width || 2) * GAME_CONFIG.TILE_SIZE / 2;
        const cy = b.position.y + (b.data?.height || 2) * GAME_CONFIG.TILE_SIZE / 2;
        // Use average unit position for distance comparison
        const avgX = wave.reduce((s, u) => s + u.position.x, 0) / wave.length;
        const avgY = wave.reduce((s, u) => s + u.position.y, 0) / wave.length;
        const dist = getDistance({ x: avgX, y: avgY }, { x: cx, y: cy });
        if (dist < nearestDist) {
          nearestDist = dist;
          nearest = { x: cx, y: cy, id: b.id };
        }
      }
      target = nearest;
    }

    if (!target) return;

    // Dispatch attack wave - attack-move to target area
    for (const unit of wave) {
      // First move near the target (attack-move so units engage enemies along the way)
      const offsetX = (Math.random() - 0.5) * GAME_CONFIG.TILE_SIZE * 4;
      const offsetY = (Math.random() - 0.5) * GAME_CONFIG.TILE_SIZE * 4;
      unit.state = UnitState.MOVING;
      unit.isAttackMoving = true;
      unit.attackTarget = target.id;
      unit.waypoints = [{
        x: target.x + offsetX,
        y: target.y + offsetY
      }];
    }

    // Update wave state
    state.waveCount++;
    state.lastWaveSize = wave.length;
    state.cooldownTimer = this.WAVE_COOLDOWN;
  }
}

export const attackWaveSystem = new AttackWaveSystem();