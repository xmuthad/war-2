export type BehaviorNodeStatus = 'running' | 'success' | 'failure';

export interface BehaviorNode {
  id: string;
  name: string;
  execute(context: AIContext): BehaviorNodeStatus;
}

export interface AIContext {
  aiPlayer: AIPlayerState;
  enemyPlayer: AIPlayerState;
  gameMap: AIGameMap;
  resources: AIResources;
  objectives: AIObjective[];
  currentTime: number;
  difficulty: AIDifficulty;
  threatLevel: ThreatLevel;
}

export interface AIPlayerState {
  faction: string;
  units: AIUnit[];
  buildings: AIBuilding[];
  powerBalance: number;
  defenseLevel: number;
  offensivePower: number;
}

export interface AIUnit {
  id: string;
  type: string;
  position: { x: number; y: number };
  health: number;
  maxHealth: number;
  attack: number;
  defense: number;
  speed: number;
  range: number;
  state: UnitAIState;
  target?: string;
  targetPosition?: { x: number; y: number };
  cargo?: number;
  isInfantry?: boolean;
  isAirborne?: boolean;
  transportId?: string;
  passengers?: string[];
  maxPassengers?: number;
  isChronoShifting?: boolean;
  isChronoCooldown?: boolean;
  data?: {
    canAttack?: boolean;
    canHarvest?: boolean;
    canBuild?: boolean;
    canCapture?: boolean;
  };
}

export interface AIBuilding {
  id: string;
  type: string;
  position: { x: number; y: number };
  health: number;
  maxHealth: number;
  isConstructed: boolean;
  isPowered?: boolean;
  canProduce?: string[];
  productionQueue: string[];
  isActive: boolean;
  rallyPoint?: { x: number; y: number };
}

export interface AIGameMap {
  width: number;
  height: number;
  resourceNodes: AIResourceNode[];
  enemyBaseLocation?: { x: number; y: number };
  friendlyBaseLocation?: { x: number; y: number };
}

export interface AIResourceNode {
  id: string;
  position: { x: number; y: number };
  type: 'ore' | 'gem' | 'crate';
  amount: number;
  assignedHarvester?: string;
}

export interface AIResources {
  money: number;
  power: number;
  ore: number;
}

export interface AIObjective {
  id: string;
  type: 'primary' | 'secondary' | 'bonus';
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  targetId?: string;
  location?: { x: number; y: number };
}

export type UnitAIState =
  | 'idle'
  | 'moving'
  | 'attacking'
  | 'defending'
  | 'harvesting'
  | 'returning'
  | 'patrolling'
  | 'retreating';

export type AIDifficulty = 'easy' | 'normal' | 'hard' | 'brutal';

export type ThreatLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface AITimer {
  name: string;
  interval: number;
  lastExecution: number;
  enabled: boolean;
}
