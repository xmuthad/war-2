import Phaser from 'phaser';
import {
  MissionUIRenderer,
  ObjectiveDisplayData,
  MissionCompleteDisplayData,
  ObjectiveType,
} from '../systems/MissionSystem';

export class PhaserMissionUIRenderer implements MissionUIRenderer {
  private scene: Phaser.Scene;
  private uiContainer: Phaser.GameObjects.Container | null = null;
  private objectiveDisplays: Map<string, Phaser.GameObjects.Container> = new Map();
  private missionCompleteObjects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.init();
  }

  private init(): void {
    this.uiContainer = this.scene.add.container(20, 100);
    this.uiContainer.setDepth(1900);
    this.uiContainer.setScrollFactor(0);
  }

  showObjectives(objectives: ObjectiveDisplayData[]): void {
    this.clearObjectives();
    this.updateObjectives(objectives);
  }

  updateObjectives(objectives: ObjectiveDisplayData[]): void {
    if (!this.uiContainer) return;

    let yOffset = 0;
    const objectiveHeight = 70;

    objectives.forEach(objective => {
      let display = this.objectiveDisplays.get(objective.id);

      if (!display) {
        display = this.createObjectiveDisplay(objective);
        this.objectiveDisplays.set(objective.id, display);
        this.uiContainer?.add(display);
      }

      display.setPosition(0, yOffset);
      this.updateObjectiveDisplay(display, objective);

      yOffset += objectiveHeight;
    });
  }

  clearObjectives(): void {
    this.objectiveDisplays.forEach(display => display.destroy());
    this.objectiveDisplays.clear();
  }

  showMissionComplete(data: MissionCompleteDisplayData): void {
    // Clean up previous mission complete objects
    this.clearMissionCompleteObjects();

    const overlay = this.scene.add.rectangle(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY,
      this.scene.cameras.main.width,
      this.scene.cameras.main.height,
      0x000000,
      0.8
    );
    overlay.setDepth(2100);
    overlay.setScrollFactor(0);
    overlay.setAlpha(0);

    const title = this.scene.add.text(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY - 100,
      data.success ? '任务完成!' : '任务失败',
      {
        fontSize: '48px',
        color: data.success ? '#00ff00' : '#ff0000',
        fontFamily: 'Arial',
        fontStyle: 'bold'
      }
    );
    title.setOrigin(0.5);
    title.setDepth(2101);
    title.setAlpha(0);
    title.setScale(0.5);

    const minutes = Math.floor(data.durationSeconds / 60);
    const seconds = data.durationSeconds % 60;
    const statsText = [
      `任务: ${data.missionName}`,
      '',
      `主要目标: ${data.primaryCompleted}/${data.primaryTotal}`,
      `次要目标: ${data.secondaryCompleted}/${data.secondaryTotal}`,
      `奖励目标: ${data.bonusCompleted}/${data.bonusTotal}`,
      '',
      `用时: ${minutes}:${seconds.toString().padStart(2, '0')}`
    ].join('\n');

    const stats = this.scene.add.text(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY,
      statsText,
      {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'Arial',
        align: 'center'
      }
    );
    stats.setOrigin(0.5);
    stats.setDepth(2101);
    stats.setAlpha(0);

    this.missionCompleteObjects = [overlay, title, stats];

    this.scene.tweens.add({
      targets: [overlay, title, stats],
      alpha: 1,
      duration: 500
    });

    this.scene.tweens.add({
      targets: title,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut'
    });

    // Auto-destroy after 8 seconds
    this.scene.time.delayedCall(8000, () => {
      this.clearMissionCompleteObjects();
    });
  }

  private clearMissionCompleteObjects(): void {
    for (const obj of this.missionCompleteObjects) {
      this.scene.tweens.killTweensOf(obj);
      obj.destroy();
    }
    this.missionCompleteObjects = [];
  }

  private createObjectiveDisplay(objective: ObjectiveDisplayData): Phaser.GameObjects.Container {
    const container = this.scene.add.container(0, 0);
    const width = 280;
    const height = 60;

    const background = this.scene.add.graphics();
    background.fillStyle(0x000000, 0.7);
    background.fillRoundedRect(0, 0, width, height, 5);

    const typeColor = this.getTypeColor(objective.type);
    background.fillStyle(typeColor, 0.3);
    background.fillRoundedRect(2, 2, 8, height - 4, 3);

    container.add(background);

    const typeIcon = this.scene.add.graphics();
    typeIcon.fillStyle(typeColor, 1);

    switch (objective.type) {
      case 'primary':
        for (let i = 0; i < 5; i++) {
          const angle = (i * 72 - 90) * Math.PI / 180;
          const nextAngle = ((i * 72 + 72) - 90) * Math.PI / 180;
          const innerAngle = ((i * 72 + 36) - 90) * Math.PI / 180;
          const outerRadius = 8;
          const innerRadius = 4;
          typeIcon.fillTriangle(
            10 + Math.cos(angle) * outerRadius,
            30 + Math.sin(angle) * outerRadius,
            10 + Math.cos(innerAngle) * innerRadius,
            30 + Math.sin(innerAngle) * innerRadius,
            10 + Math.cos(nextAngle) * outerRadius,
            30 + Math.sin(nextAngle) * outerRadius
          );
        }
        break;
      case 'secondary':
        typeIcon.fillCircle(10, 30, 6);
        break;
      case 'bonus':
        typeIcon.fillTriangle(10, 22, 4, 38, 16, 38);
        break;
    }
    container.add(typeIcon);

    const titleText = this.scene.add.text(25, 8, objective.title, {
      fontSize: '14px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold'
    });
    container.add(titleText);

    const descText = this.scene.add.text(25, 26, objective.description, {
      fontSize: '11px',
      color: '#aaaaaa',
      fontFamily: 'Arial',
      wordWrap: { width: width - 30 }
    });
    container.add(descText);

    const progressText = this.scene.add.text(25, 42, '', {
      fontSize: '10px',
      color: '#888888',
      fontFamily: 'Arial'
    });
    container.add(progressText);

    container.setData('progressText', progressText);

    return container;
  }

  private updateObjectiveDisplay(container: Phaser.GameObjects.Container, objective: ObjectiveDisplayData): void {
    const progressText = container.getData('progressText') as Phaser.GameObjects.Text;
    if (!progressText) return;

    const progress = Math.floor((objective.currentValue / objective.targetValue) * 100);

    let statusText = '';
    switch (objective.status) {
      case 'active':
        statusText = `[${objective.currentValue}/${objective.targetValue}] (${progress}%)`;
        break;
      case 'completed':
        statusText = '✓ 完成';
        progressText.setColor('#00ff00');
        break;
      case 'failed':
        statusText = '✗ 失败';
        progressText.setColor('#ff0000');
        break;
      case 'skipped':
        statusText = '已跳过';
        progressText.setColor('#888888');
        break;
    }

    progressText.setText(statusText);
  }

  private getTypeColor(type: ObjectiveType): number {
    switch (type) {
      case 'primary': return 0xffd700;
      case 'secondary': return 0x4488ff;
      case 'bonus': return 0xff69b4;
      default: return 0xffffff;
    }
  }

  dispose(): void {
    this.clearMissionCompleteObjects();
    this.objectiveDisplays.forEach(d => d.destroy());
    this.objectiveDisplays.clear();
    this.uiContainer?.destroy();
    this.uiContainer = null;
  }
}
