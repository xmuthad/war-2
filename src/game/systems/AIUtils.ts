import type { AIContext, AIDifficulty, ThreatLevel } from './AITypes';

export function getDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export interface DifficultyConfig {
  aggressionLevel: number;
  defensiveLevel: number;
  economicLevel: number;
  reactionTime: number;
}

export function getDifficultyConfig(difficulty: AIDifficulty): DifficultyConfig {
  switch (difficulty) {
    case 'easy':
      return {
        aggressionLevel: 0.3,
        defensiveLevel: 0.7,
        economicLevel: 0.6,
        reactionTime: 1000,
      };
    case 'normal':
      return {
        aggressionLevel: 0.5,
        defensiveLevel: 0.5,
        economicLevel: 0.5,
        reactionTime: 500,
      };
    case 'hard':
      return {
        aggressionLevel: 0.7,
        defensiveLevel: 0.4,
        economicLevel: 0.6,
        reactionTime: 300,
      };
    case 'brutal':
      return {
        aggressionLevel: 0.9,
        defensiveLevel: 0.3,
        economicLevel: 0.7,
        reactionTime: 100,
      };
  }
}

export function calculateThreatLevel(context: AIContext): ThreatLevel {
  const enemyUnits = context.enemyPlayer.units.filter(u => u.state === 'attacking');
  const myUnits = context.aiPlayer.units;
  const myBuildings = context.aiPlayer.buildings.filter(b => b.isConstructed);

  if (enemyUnits.length === 0) return 'none';

  const enemyPower = enemyUnits.reduce((sum, u) => sum + (u.health / u.maxHealth), 0);
  const myDefense = myBuildings.reduce((sum, b) => sum + (b.health / b.maxHealth), 0);
  const myOffense = myUnits.reduce((sum, u) => sum + (u.health / u.maxHealth), 0);

  const threatScore = enemyPower / (myDefense + myOffense + 1);

  if (threatScore > 3) return 'critical';
  if (threatScore > 2) return 'high';
  if (threatScore > 1) return 'medium';
  return 'low';
}
