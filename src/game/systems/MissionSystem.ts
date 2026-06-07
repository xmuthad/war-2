export type ObjectiveType = 'primary' | 'secondary' | 'bonus';
export type ObjectiveStatus = 'active' | 'completed' | 'failed' | 'skipped';

export interface Objective {
  id: string;
  type: ObjectiveType;
  title: string;
  description: string;
  status: ObjectiveStatus;
  progress: number;
  maxProgress: number;
  targetValue: number;
  currentValue: number;
  timeLimit?: number;
  startTime: number;
  completedTime?: number;
  rewards?: {
    credits?: number;
    resources?: Record<string, number>;
    units?: string[];
  };
  prerequisites?: string[];
  onComplete?: () => void;
  onFail?: () => void;
}

export interface MissionConfig {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'normal' | 'hard' | 'expert';
  objectives: Omit<Objective, 'id' | 'status' | 'progress' | 'startTime'>[];
  timeLimit?: number;
  rewards?: {
    credits?: number;
    resources?: Record<string, number>;
    experience?: number;
  };
}

export interface MissionState {
  missionId: string;
  startTime: number;
  endTime?: number;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  objectives: Map<string, Objective>;
  totalObjectives: number;
  completedObjectives: number;
  failedObjectives: number;
}

// --- UI Renderer Interface (decouples game logic from Phaser UI) ---

export interface ObjectiveDisplayData {
  id: string;
  type: ObjectiveType;
  title: string;
  description: string;
  status: ObjectiveStatus;
  currentValue: number;
  targetValue: number;
}

export interface MissionCompleteDisplayData {
  missionName: string;
  success: boolean;
  primaryCompleted: number;
  primaryTotal: number;
  secondaryCompleted: number;
  secondaryTotal: number;
  bonusCompleted: number;
  bonusTotal: number;
  durationSeconds: number;
}

export interface MissionUIRenderer {
  showObjectives(objectives: ObjectiveDisplayData[]): void;
  updateObjectives(objectives: ObjectiveDisplayData[]): void;
  clearObjectives(): void;
  showMissionComplete(data: MissionCompleteDisplayData): void;
  dispose(): void;
}

// --- MissionSystem (pure game logic, no Phaser dependency) ---

export class MissionSystem {
  private currentMission: MissionState | null = null;
  private missionConfig: MissionConfig | null = null;
  private uiRenderer?: MissionUIRenderer;
  private onMissionCompleteCallbacks: Set<(success: boolean) => void> = new Set();
  private onObjectiveUpdateCallbacks: Set<(objective: Objective) => void> = new Set();
  private missionTimer: number = 0;
  private paused: boolean = false;

  constructor() {}

  setUIRenderer(renderer: MissionUIRenderer): void {
    this.uiRenderer = renderer;
  }

  create(): void {
    // UI setup is handled by the uiRenderer
  }

  startMission(config: MissionConfig): void {
    this.missionConfig = config;
    this.missionTimer = 0;
    this.paused = false;

    const objectives = new Map<string, Objective>();
    config.objectives.forEach((obj, index) => {
      const objective: Objective = {
        ...obj,
        id: `obj_${index}`,
        status: 'active',
        progress: 0,
        startTime: Date.now()
      };
      objectives.set(objective.id, objective);
    });

    this.currentMission = {
      missionId: config.id,
      startTime: Date.now(),
      status: 'active',
      objectives,
      totalObjectives: objectives.size,
      completedObjectives: 0,
      failedObjectives: 0
    };

    this.uiRenderer?.clearObjectives();
    this.uiRenderer?.showObjectives(this.getObjectivesDisplayData());
  }

  updateObjectiveProgress(objectiveId: string, value: number): void {
    if (!this.currentMission) return;

    const objective = this.currentMission.objectives.get(objectiveId);
    if (!objective || objective.status !== 'active') return;

    objective.currentValue = Math.min(value, objective.targetValue);
    objective.progress = objective.currentValue / objective.targetValue;

    if (objective.currentValue >= objective.targetValue) {
      this.completeObjective(objectiveId);
    }

    this.uiRenderer?.updateObjectives(this.getObjectivesDisplayData());
    this.notifyObjectiveUpdate(objective);
  }

  incrementObjectiveProgress(objectiveId: string, amount: number = 1): void {
    if (!this.currentMission) return;

    const objective = this.currentMission.objectives.get(objectiveId);
    if (!objective || objective.status !== 'active') return;

    this.updateObjectiveProgress(objectiveId, objective.currentValue + amount);
  }

  completeObjective(objectiveId: string): void {
    if (!this.currentMission) return;

    const objective = this.currentMission.objectives.get(objectiveId);
    if (!objective || objective.status !== 'active') return;

    objective.status = 'completed';
    objective.completedTime = Date.now();
    this.currentMission.completedObjectives++;

    objective.onComplete?.();

    this.checkMissionCompletion();
  }

  failObjective(objectiveId: string): void {
    if (!this.currentMission) return;

    const objective = this.currentMission.objectives.get(objectiveId);
    if (!objective || objective.status !== 'active') return;

    objective.status = 'failed';
    this.currentMission.failedObjectives++;

    objective.onFail?.();

    this.checkMissionCompletion();
  }

  skipObjective(objectiveId: string): void {
    if (!this.currentMission) return;

    const objective = this.currentMission.objectives.get(objectiveId);
    if (!objective || objective.status !== 'active') return;

    const hasPrerequisites = objective.prerequisites?.every(prereqId => {
      const prereq = this.currentMission?.objectives.get(prereqId);
      return prereq?.status === 'completed';
    });

    if (!hasPrerequisites && objective.prerequisites?.length) {
      return;
    }

    objective.status = 'skipped';
    this.checkMissionCompletion();
  }

  private checkMissionCompletion(): void {
    if (!this.currentMission) return;

    const primaryObjectives = Array.from(this.currentMission.objectives.values())
      .filter(o => o.type === 'primary');

    const allPrimaryComplete = primaryObjectives.every(o => o.status === 'completed');

    const anyPrimaryFailed = primaryObjectives.some(o => o.status === 'failed');

    if (allPrimaryComplete) {
      this.completeMission(true);
    } else if (anyPrimaryFailed) {
      this.completeMission(false);
    }
  }

  completeMission(success: boolean): void {
    if (!this.currentMission) return;

    this.currentMission.status = success ? 'completed' : 'failed';
    this.currentMission.endTime = Date.now();

    if (this.missionConfig?.rewards && success) {
      this.grantRewards(this.missionConfig.rewards);
    }

    this.uiRenderer?.showMissionComplete(this.getMissionCompleteData(success));

    this.notifyMissionComplete(success);
  }

  private grantRewards(_rewards: NonNullable<MissionConfig['rewards']>): void {
    // Rewards are applied externally via onMissionComplete callbacks
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  abandonMission(): void {
    if (!this.currentMission) return;

    this.currentMission.status = 'abandoned';
    this.currentMission.endTime = Date.now();
    this.notifyMissionComplete(false);
  }

  update(delta: number): void {
    if (!this.currentMission || this.paused) return;

    this.missionTimer += delta;

    if (this.currentMission.status !== 'active') return;

    if (this.missionConfig?.timeLimit && this.missionTimer >= this.missionConfig.timeLimit * 1000) {
      this.failAllObjectives();
      this.completeMission(false);
    }

    this.currentMission.objectives.forEach(objective => {
      if (objective.status === 'active' && objective.timeLimit) {
        const elapsed = Date.now() - objective.startTime;
        if (elapsed >= objective.timeLimit) {
          this.failObjective(objective.id);
        }
      }
    });
  }

  private failAllObjectives(): void {
    if (!this.currentMission) return;

    this.currentMission.objectives.forEach(objective => {
      if (objective.status === 'active') {
        objective.status = 'failed';
        this.currentMission!.failedObjectives++;
      }
    });
  }

  onMissionComplete(callback: (success: boolean) => void): () => void {
    this.onMissionCompleteCallbacks.add(callback);
    return () => {
      this.onMissionCompleteCallbacks.delete(callback);
    };
  }

  onObjectiveUpdate(callback: (objective: Objective) => void): () => void {
    this.onObjectiveUpdateCallbacks.add(callback);
    return () => {
      this.onObjectiveUpdateCallbacks.delete(callback);
    };
  }

  private notifyMissionComplete(success: boolean): void {
    this.onMissionCompleteCallbacks.forEach(cb => cb(success));
  }

  private notifyObjectiveUpdate(objective: Objective): void {
    this.onObjectiveUpdateCallbacks.forEach(cb => cb(objective));
  }

  private getObjectivesDisplayData(): ObjectiveDisplayData[] {
    if (!this.currentMission) return [];
    return Array.from(this.currentMission.objectives.values()).map(obj => ({
      id: obj.id,
      type: obj.type,
      title: obj.title,
      description: obj.description,
      status: obj.status,
      currentValue: obj.currentValue,
      targetValue: obj.targetValue
    }));
  }

  private getMissionCompleteData(success: boolean): MissionCompleteDisplayData {
    const objectivesArray = this.currentMission
      ? Array.from(this.currentMission.objectives.values())
      : [];
    const primary = objectivesArray.filter(o => o.type === 'primary');
    const secondary = objectivesArray.filter(o => o.type === 'secondary');
    const bonus = objectivesArray.filter(o => o.type === 'bonus');
    const duration = this.currentMission?.endTime && this.currentMission.startTime
      ? Math.floor((this.currentMission.endTime - this.currentMission.startTime) / 1000)
      : 0;

    return {
      missionName: this.missionConfig?.name || 'Unknown',
      success,
      primaryCompleted: primary.filter(o => o.status === 'completed').length,
      primaryTotal: primary.length,
      secondaryCompleted: secondary.filter(o => o.status === 'completed').length,
      secondaryTotal: secondary.length,
      bonusCompleted: bonus.filter(o => o.status === 'completed').length,
      bonusTotal: bonus.length,
      durationSeconds: duration
    };
  }

  getCurrentMission(): MissionState | null {
    return this.currentMission ? { ...this.currentMission } : null;
  }

  getObjective(objectiveId: string): Objective | undefined {
    return this.currentMission?.objectives.get(objectiveId);
  }

  getActiveObjectives(): Objective[] {
    if (!this.currentMission) return [];
    return Array.from(this.currentMission.objectives.values())
      .filter(o => o.status === 'active');
  }

  dispose(): void {
    this.currentMission = null;
    this.missionConfig = null;
    this.uiRenderer?.dispose();
    this.uiRenderer = undefined;
    this.onMissionCompleteCallbacks.clear();
    this.onObjectiveUpdateCallbacks.clear();
  }
}
