import type { BehaviorNodeStatus, BehaviorNode, AIContext } from './AITypes';

export type { BehaviorNodeStatus, BehaviorNode, AIContext };
export type {
  AIPlayerState,
  AIUnit,
  AIBuilding,
  AIGameMap,
  AIResourceNode,
  AIResources,
  AIObjective,
  UnitAIState,
  AIDifficulty,
  ThreatLevel,
  AITimer,
} from './AITypes';

export class CompositeNode implements BehaviorNode {
  id: string;
  name: string;
  protected children: BehaviorNode[] = [];

  constructor(id: string, name: string, children: BehaviorNode[] = []) {
    this.id = id;
    this.name = name;
    this.children = children;
  }

  addChild(child: BehaviorNode): this {
    this.children.push(child);
    return this;
  }

  execute(_context: AIContext): BehaviorNodeStatus {
    throw new Error('CompositeNode.execute must be implemented by subclass');
  }

  protected executeChild(child: BehaviorNode, context: AIContext): BehaviorNodeStatus {
    return child.execute(context);
  }
}

export class SequenceNode extends CompositeNode {
  constructor(id: string, name: string, children: BehaviorNode[] = []) {
    super(id, name, children);
  }

  execute(context: AIContext): BehaviorNodeStatus {
    for (const child of this.children) {
      const status = this.executeChild(child, context);
      if (status !== 'success') {
        return status === 'running' ? 'running' : 'failure';
      }
    }
    return 'success';
  }
}

export class SelectorNode extends CompositeNode {
  constructor(id: string, name: string, children: BehaviorNode[] = []) {
    super(id, name, children);
  }

  execute(context: AIContext): BehaviorNodeStatus {
    for (const child of this.children) {
      const status = this.executeChild(child, context);
      if (status !== 'failure') {
        return status === 'running' ? 'running' : 'success';
      }
    }
    return 'failure';
  }
}

export class ParallelNode extends CompositeNode {
  private requiredSuccess: number;
  private requiredFailure: number;

  constructor(
    id: string,
    name: string,
    requiredSuccess: number,
    requiredFailure: number,
    children: BehaviorNode[] = []
  ) {
    super(id, name, children);
    this.requiredSuccess = requiredSuccess;
    this.requiredFailure = requiredFailure;
  }

  execute(context: AIContext): BehaviorNodeStatus {
    let successCount = 0;
    let failureCount = 0;

    for (const child of this.children) {
      const status = this.executeChild(child, context);
      if (status === 'success') successCount++;
      else if (status === 'failure') failureCount++;
    }

    if (successCount >= this.requiredSuccess) return 'success';
    if (failureCount >= this.requiredFailure) return 'failure';
    return 'running';
  }
}

export class RandomSelectorNode extends CompositeNode {
  private weights: number[] = [];

  constructor(id: string, name: string, children: BehaviorNode[] = [], weights: number[] = []) {
    super(id, name, children);
    this.weights = weights.length === children.length ? weights : children.map(() => 1);
  }

  execute(context: AIContext): BehaviorNodeStatus {
    const shuffled = this.getShuffledChildren();
    for (const child of shuffled) {
      const status = this.executeChild(child, context);
      if (status !== 'failure') {
        return status;
      }
    }
    return 'failure';
  }

  private getShuffledChildren(): BehaviorNode[] {
    const result: BehaviorNode[] = [];
    const indices = this.children.map((_, i) => i);

    while (indices.length > 0) {
      const totalWeight = this.weights.reduce((sum, w, i) => 
        indices.includes(i) ? sum + w : sum, 0
      );
      let random = Math.random() * totalWeight;

      for (let i = 0; i < indices.length; i++) {
        random -= this.weights[indices[i]];
        if (random <= 0) {
          result.push(this.children[indices[i]]);
          indices.splice(i, 1);
          break;
        }
      }
    }

    return result;
  }
}

export abstract class DecoratorNode implements BehaviorNode {
  id: string;
  name: string;
  protected child: BehaviorNode;

  constructor(id: string, name: string, child: BehaviorNode) {
    this.id = id;
    this.name = name;
    this.child = child;
  }

  execute(_context: AIContext): BehaviorNodeStatus {
    throw new Error('DecoratorNode.execute must be implemented by subclass');
  }
}

export class InverterNode extends DecoratorNode {
  constructor(id: string, name: string, child: BehaviorNode) {
    super(id, name, child);
  }

  execute(context: AIContext): BehaviorNodeStatus {
    const status = this.child.execute(context);
    if (status === 'success') return 'failure';
    if (status === 'failure') return 'success';
    return 'running';
  }
}

export class RepeaterNode extends DecoratorNode {
  private maxRepeats: number;
  private currentRepeats: number = 0;

  constructor(id: string, name: string, child: BehaviorNode, maxRepeats: number = -1) {
    super(id, name, child);
    this.maxRepeats = maxRepeats;
  }

  execute(context: AIContext): BehaviorNodeStatus {
    if (this.maxRepeats > 0 && this.currentRepeats >= this.maxRepeats) {
      this.currentRepeats = 0;
      return 'success';
    }

    const status = this.child.execute(context);
    if (status === 'running') return 'running';

    this.currentRepeats++;
    if (this.maxRepeats < 0 || this.currentRepeats < this.maxRepeats) {
      return 'running';
    }

    this.currentRepeats = 0;
    return 'success';
  }
}

export class ConditionNode implements BehaviorNode {
  id: string;
  name: string;
  private condition: (context: AIContext) => boolean;

  constructor(id: string, name: string, condition: (context: AIContext) => boolean) {
    this.id = id;
    this.name = name;
    this.condition = condition;
  }

  execute(context: AIContext): BehaviorNodeStatus {
    return this.condition(context) ? 'success' : 'failure';
  }
}

export class ActionNode implements BehaviorNode {
  id: string;
  name: string;
  private action: (context: AIContext) => BehaviorNodeStatus;
  private status: BehaviorNodeStatus = 'running';

  constructor(id: string, name: string, action: (context: AIContext) => BehaviorNodeStatus) {
    this.id = id;
    this.name = name;
    this.action = action;
  }

  execute(context: AIContext): BehaviorNodeStatus {
    this.status = this.action(context);
    return this.status;
  }

  reset(): void {
    this.status = 'running';
  }
}
