import { Unit, UnitType, UnitState } from '../../types';
import { gameEventBus } from './GameEventBus';

export class ChronoShiftSystem {
  update(deltaTime: number, units: Unit[], gameTime: number): void {
    for (const unit of units) {
      if (unit.type !== UnitType.CHRONO) continue;

      // Process chrono shift charging
      if (unit.isChronoShifting) {
        unit.chronoShiftTimer = (unit.chronoShiftTimer ?? 0) - deltaTime;
        if (unit.chronoShiftTimer <= 0) {
          // Teleport to target position
          if (unit.chronoShiftTarget) {
            unit.position = { ...unit.chronoShiftTarget };
          }
          unit.chronoShiftTarget = undefined;
          unit.isChronoShifting = false;
          unit.isChronoCooldown = true;
          unit.chronoShiftTimer = 5; // 5s cooldown
          unit.state = UnitState.IDLE;
          gameEventBus.emit('unit:teleport', {
            unitId: unit.id,
            position: { ...unit.position },
          });
        }
      }

      // Process chrono cooldown
      if (unit.isChronoCooldown) {
        unit.chronoShiftTimer = (unit.chronoShiftTimer ?? 0) - deltaTime;
        if (unit.chronoShiftTimer <= 0) {
          unit.isChronoCooldown = false;
          unit.chronoShiftTimer = 0;
        }
      }
    }
  }
}
