import Phaser from 'phaser';
import { gameEventBus } from './GameEventBus';

/**
 * Categories of sounds in the game
 * @public
 */
export type SoundCategory = 'ui' | 'combat' | 'movement' | 'building' | 'ambient' | 'voice';

/**
 * Configuration for sound system
 * @public
 */
export interface SoundConfig {
  /** Master volume (0-1) */
  volume: number;
  /** Whether sounds are muted */
  muted: boolean;
  /** Whether sound effects are enabled */
  enableSounds: boolean;
  /** Whether background music is enabled */
  enableMusic: boolean;
}

/**
 * Default sound configuration
 * @public
 */
export const SOUND_CONFIG: SoundConfig = {
  volume: 0.7,
  muted: false,
  enableSounds: true,
  enableMusic: true
};

/**
 * Represents a sound effect definition
 * @public
 */
export interface SoundEffect {
  /** Unique key for the sound */
  key: string;
  /** Category this sound belongs to */
  category: SoundCategory;
  /** Base volume (0-1) */
  volume?: number;
  /** Playback rate multiplier */
  rate?: number;
  /** Whether to loop the sound */
  loops?: boolean;
}

/**
 * Represents a voice line definition
 * @public
 */
export interface VoiceLine {
  /** Unique key for the voice line */
  key: string;
  /** Category of the voice line */
  category: 'acknowledgement' | 'command' | 'attack' | 'help' | 'death';
  /** Probability of playing (0-1) */
  probability?: number;
}

/**
 * Default sound effects configuration
 * @public
 */
export const SOUND_EFFECTS: Record<string, SoundEffect> = {
  uiClick: { key: 'ui_click', category: 'ui', volume: 0.5 },
  uiSelect: { key: 'ui_select', category: 'ui', volume: 0.6 },
  uiError: { key: 'ui_error', category: 'ui', volume: 0.4 },
  unitMove: { key: 'unit_move', category: 'movement', volume: 0.5 },
  unitAttack: { key: 'unit_attack', category: 'combat', volume: 0.7 },
  unitSelect: { key: 'unit_select', category: 'ui', volume: 0.6 },
  unitDestroyed: { key: 'unit_destroyed', category: 'combat', volume: 0.8 },
  buildingPlace: { key: 'building_place', category: 'building', volume: 0.6 },
  buildingComplete: { key: 'building_complete', category: 'building', volume: 0.7 },
  buildingStart: { key: 'building_start', category: 'building', volume: 0.5 },
  resourceCollect: { key: 'resource_collect', category: 'building', volume: 0.3 },
  explosion: { key: 'explosion', category: 'combat', volume: 0.8 },
  bullet: { key: 'bullet', category: 'combat', volume: 0.4 },
  radarPing: { key: 'radar_ping', category: 'ui', volume: 0.5 },
  alert: { key: 'alert', category: 'combat', volume: 0.7 },
  upgradeComplete: { key: 'upgrade_complete', category: 'building', volume: 0.6 },
  empAttack: { key: 'emp', category: 'combat', volume: 0.7 },
  resourceDepleted: { key: 'click', category: 'ui', volume: 0.5 },
  chronoShift: { key: 'teleport', category: 'combat', volume: 0.6 },
  buildingDestroyed: { key: 'building_destroyed', category: 'combat', volume: 0.6 },
  buildingHit: { key: 'building_hit', category: 'combat', volume: 0.5 },
  superweaponCharging: { key: 'superweapon_charging', category: 'combat', volume: 0.7 },
  superweaponLaunch: { key: 'superweapon_launch', category: 'combat', volume: 0.8 },
  unitProduced: { key: 'unit_produced', category: 'building', volume: 0.4 },
  oreDeposit: { key: 'ore_deposit', category: 'building', volume: 0.3 },
  lowPower: { key: 'low_power', category: 'ui', volume: 0.5 },
  baseUnderAttack: { key: 'base_under_attack', category: 'combat', volume: 0.7 },
  upgradeStarted: { key: 'upgrade_started', category: 'building', volume: 0.4 },
  nukeExplosion: { key: 'nuke_explosion', category: 'combat', volume: 0.9 },
  ironCurtain: { key: 'iron_curtain', category: 'combat', volume: 0.6 },
  chronosphere: { key: 'chronosphere', category: 'combat', volume: 0.6 }
};

/**
 * Default voice lines configuration
 * @public
 */
export const VOICE_LINES: Record<string, VoiceLine> = {
  ack1: { key: 'voice_ack_1', category: 'acknowledgement', probability: 0.3 },
  ack2: { key: 'voice_ack_2', category: 'acknowledgement', probability: 0.3 },
  ack3: { key: 'voice_ack_3', category: 'acknowledgement', probability: 0.3 },
  move1: { key: 'voice_move_1', category: 'command', probability: 0.4 },
  move2: { key: 'voice_move_2', category: 'command', probability: 0.3 },
  attack1: { key: 'voice_attack_1', category: 'attack', probability: 0.5 },
  attack2: { key: 'voice_attack_2', category: 'attack', probability: 0.3 },
  help1: { key: 'voice_help_1', category: 'help', probability: 0.6 },
  death1: { key: 'voice_death_1', category: 'death', probability: 0.8 }
};

/**
 * Manages game sounds, music, and voice lines
 * @public
 */
export class GameSoundManager {
  private scene: Phaser.Scene;
  private config: SoundConfig;
  private sounds: Map<string, Phaser.Sound.BaseSound> = new Map();
  private music: Map<string, Phaser.Sound.BaseSound> = new Map();
  private categoryVolumes: Map<SoundCategory, number> = new Map();
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private lastVoiceTime: Map<string, number> = new Map();
  private voiceCooldown: number = 2000;
  private cameraPosition: { x: number; y: number } = { x: 0, y: 0 };
  private readonly SOUND_FALLOFF_RADIUS = 800; // 音效衰减半径（像素）
  private readonly SOUND_MIN_VOLUME = 0.1; // 最小音量
  private volumeChangedUnsub?: () => void;

  /**
   * Creates a new GameSoundManager instance
   * @param scene - The Phaser scene this manager belongs to
   * @param config - Optional configuration overrides
   */
  constructor(scene: Phaser.Scene, config: Partial<SoundConfig> = {}) {
    this.scene = scene;
    this.config = { ...SOUND_CONFIG, ...config };

    this.initializeCategoryVolumes();
    this.listenForSettingsChanges();
  }

  /** Listen for volume change events from settings panel */
  private listenForSettingsChanges(): void {
    this.volumeChangedUnsub = gameEventBus.on('settings:volumeChanged', (event) => {
      const data = event.data as { master?: number; music?: number; sfx?: number } | undefined;
      if (!data) return;
      if (data.master !== undefined) {
        this.setMasterVolume(data.master);
      }
      if (data.music !== undefined) {
        this.categoryVolumes.set('ambient', data.music);
      }
      if (data.sfx !== undefined) {
        this.categoryVolumes.set('combat', data.sfx);
        this.categoryVolumes.set('movement', data.sfx);
        this.categoryVolumes.set('building', data.sfx);
        this.categoryVolumes.set('ui', data.sfx);
      }
    });
  }

  /**
   * Initializes category volumes to default values
   * @internal
   */
  private initializeCategoryVolumes(): void {
    this.categoryVolumes.set('ui', 1.0);
    this.categoryVolumes.set('combat', 0.9);
    this.categoryVolumes.set('movement', 0.6);
    this.categoryVolumes.set('building', 0.7);
    this.categoryVolumes.set('ambient', 0.4);
    this.categoryVolumes.set('voice', 1.0);
  }

  /**
   * Sets the camera position for distance-based sound attenuation
   * @param x - Camera x position in world coordinates
   * @param y - Camera y position in world coordinates
   */
  setCameraPosition(x: number, y: number): void {
    this.cameraPosition = { x, y };
  }

  /**
   * Preloads all sound assets
   */
  preload(): void {
    try {
      Object.values(SOUND_EFFECTS).forEach(sfx => {
        this.scene.load.audio(sfx.key, `/assets/sounds/${sfx.key}.mp3`);
      });

      Object.values(VOICE_LINES).forEach(voice => {
        this.scene.load.audio(voice.key, `/assets/sounds/voices/${voice.key}.mp3`);
      });

      this.scene.load.audio('music_battle', '/assets/sounds/music/battle.mp3');
      this.scene.load.audio('music_calm', '/assets/sounds/music/calm.mp3');
      this.scene.load.audio('music_menu', '/assets/sounds/music/menu.mp3');
    } catch (error) {
      console.error('Failed to preload sounds:', error);
    }
  }

  /**
   * Plays a sound effect
   * @param sfxKey - Key of the sound effect to play
   * @param options - Playback options
   */
  play(sfxKey: string, options?: {
    volume?: number;
    rate?: number;
    loops?: boolean;
    forceRestart?: boolean;
    position?: { x: number; y: number };
  }): void {
    if (!this.config.enableSounds || this.config.muted) return;

    const sfx = SOUND_EFFECTS[sfxKey];
    if (!sfx) return;

    // Check if audio is in Phaser cache
    if (!this.scene.sound.get(sfx.key)) {
      console.warn(`Audio "${sfx.key}" not yet loaded, skipping play`);
      return;
    }

    // Calculate distance-based volume attenuation
    let distanceVolume = 1;
    if (options?.position) {
      const dx = options.position.x - this.cameraPosition.x;
      const dy = options.position.y - this.cameraPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > this.SOUND_FALLOFF_RADIUS) {
        return; // 太远，不播放
      }

      const distanceFactor = 1 - (distance / this.SOUND_FALLOFF_RADIUS);
      distanceVolume = Math.max(this.SOUND_MIN_VOLUME, distanceFactor);
    }

    let sound = this.sounds.get(sfxKey);

    if (!sound || options?.forceRestart) {
      if (sound) {
        sound.destroy();
      }
      sound = this.scene.sound.add(sfx.key, {
        volume: (options?.volume ?? sfx.volume ?? 1) * this.config.volume * distanceVolume,
        rate: options?.rate ?? sfx.rate ?? 1,
        loop: options?.loops ?? sfx.loops ?? false
      });
      this.sounds.set(sfxKey, sound);
    }

    sound?.play();
  }

  /**
   * Plays a voice line
   * @param voiceKey - Key of the voice line to play
   * @param forcePlay - Whether to ignore probability and cooldown
   */
  playVoice(voiceKey: string, forcePlay: boolean = false): void {
    if (!this.config.enableSounds || this.config.muted) return;

    const voice = VOICE_LINES[voiceKey];
    if (!voice) return;

    // Check if audio is in Phaser cache
    if (!this.scene.sound.get(voice.key)) {
      console.warn(`Voice "${voice.key}" not yet loaded, skipping play`);
      return;
    }

    if (!forcePlay && voice.probability && Math.random() > voice.probability) {
      return;
    }

    const lastPlayed = this.lastVoiceTime.get(voiceKey) || 0;
    const now = Date.now();
    if (now - lastPlayed < this.voiceCooldown) {
      return;
    }

    let sound = this.sounds.get(voiceKey);
    if (sound && sound.isPlaying) {
      return;
    }

    // Destroy old sound object before creating new one
    if (sound) {
      sound.destroy();
    }

    sound = this.scene.sound.add(voice.key, {
      volume: this.categoryVolumes.get('voice')! * this.config.volume
    });
    this.sounds.set(voiceKey, sound);
    sound?.play();

    this.lastVoiceTime.set(voiceKey, now);
  }

  /**
   * Plays a random voice line from a category
   * @param category - Category of voice lines to choose from
   */
  playRandomVoice(category: VoiceLine['category']): void {
    const voicesInCategory = Object.values(VOICE_LINES).filter(
      v => v.category === category
    );
    if (voicesInCategory.length === 0) return;

    const randomVoice = voicesInCategory[Math.floor(Math.random() * voicesInCategory.length)];
    this.playVoice(randomVoice.key);
  }

  /**
   * Starts playing background music
   * @param musicKey - Key of the music to play
   * @param fadeDuration - Fade duration in milliseconds (0 = no fade)
   */
  playMusic(musicKey: string, fadeDuration: number = 1000): void {
    if (!this.config.enableMusic || this.config.muted) return;

    if (this.currentMusic) {
      if (fadeDuration > 0) {
        this.scene.tweens.add({
          targets: this.currentMusic,
          volume: 0,
          duration: fadeDuration / 2,
          onComplete: () => {
            if (!this.scene?.scene?.isActive()) return;
            this.currentMusic?.stop();
            this.currentMusic = null;
            this.startMusic(musicKey, fadeDuration / 2);
          }
        });
      } else {
        this.currentMusic.stop();
        this.currentMusic = null;
        this.startMusic(musicKey, 0);
      }
    } else {
      this.startMusic(musicKey, fadeDuration);
    }
  }

  /**
   * Internal method to start music playback
   * @param musicKey - Key of the music to start
   * @param fadeInDuration - Fade in duration in milliseconds
   * @internal
   */
  private startMusic(musicKey: string, fadeInDuration: number): void {
    const music = this.scene.sound.add(musicKey, {
      volume: fadeInDuration > 0 ? 0 : this.config.volume,
      loop: true
    });

    music.play();

    if (fadeInDuration > 0) {
      this.scene.tweens.add({
        targets: music,
        volume: this.config.volume,
        duration: fadeInDuration
      });
    }

    this.currentMusic = music;
  }

  /**
   * Stops the current music
   * @param fadeDuration - Fade out duration in milliseconds (0 = no fade)
   */
  stopMusic(fadeDuration: number = 1000): void {
    if (!this.currentMusic) return;

    if (fadeDuration > 0) {
      this.scene.tweens.add({
        targets: this.currentMusic,
        volume: 0,
        duration: fadeDuration,
        onComplete: () => {
          if (!this.scene?.scene?.isActive()) return;
          this.currentMusic?.stop();
          this.currentMusic = null;
        }
      });
    } else {
      this.currentMusic.stop();
      this.currentMusic = null;
    }
  }

  /**
   * Sets the master volume for all sounds
   * @param volume - Volume level (0-1)
   */
  setMasterVolume(volume: number): void {
    this.config.volume = Math.max(0, Math.min(1, volume));

    if (this.currentMusic) {
      try {
        (this.currentMusic as Phaser.Sound.WebAudioSound).setVolume(this.config.volume);
      } catch (error) {
        console.error('Failed to set music volume:', error);
      }
    }

    this.sounds.forEach((sound, key) => {
      const sfx = SOUND_EFFECTS[key];
      if (sfx) {
        try {
          (sound as Phaser.Sound.WebAudioSound).setVolume((sfx.volume ?? 1) * this.config.volume);
        } catch (error) {
          console.error(`Failed to set volume for sound ${key}:`, error);
        }
      }
    });
  }

  /**
   * Sets the volume for a specific sound category
   * @param category - Sound category to adjust
   * @param volume - Volume level (0-1)
   */
  setCategoryVolume(category: SoundCategory, volume: number): void {
    this.categoryVolumes.set(category, Math.max(0, Math.min(1, volume)));

    Object.entries(SOUND_EFFECTS).forEach(([key, sfx]) => {
      if (sfx.category === category) {
        const sound = this.sounds.get(key);
        if (sound) {
          try {
            (sound as Phaser.Sound.WebAudioSound).setVolume((sfx.volume ?? 1) * this.categoryVolumes.get(category)! * this.config.volume);
          } catch (error) {
            console.error(`Failed to set category volume for ${key}:`, error);
          }
        }
      }
    });
  }

  /**
   * Sets the muted state for all sounds
   * @param muted - Whether to mute all sounds
   */
  setMuted(muted: boolean): void {
    this.config.muted = muted;

    if (this.currentMusic) {
      (this.currentMusic as Phaser.Sound.WebAudioSound).setMute(muted);
    }

    this.sounds.forEach(sound => {
      (sound as Phaser.Sound.WebAudioSound).setMute(muted);
    });
  }

  /**
   * Enables or disables sound effects
   * @param enabled - Whether sound effects should be enabled
   */
  setSoundsEnabled(enabled: boolean): void {
    this.config.enableSounds = enabled;

    if (!enabled) {
      this.sounds.forEach(sound => {
        if (sound.isPlaying) {
          sound.stop();
        }
      });
    }
  }

  /**
   * Enables or disables background music
   * @param enabled - Whether background music should be enabled
   */
  setMusicEnabled(enabled: boolean): void {
    this.config.enableMusic = enabled;

    if (!enabled && this.currentMusic) {
      this.currentMusic.stop();
      this.currentMusic = null;
    }
  }

  /**
   * Pauses all currently playing sounds and music
   */
  pauseAll(): void {
    if (this.currentMusic && this.currentMusic.isPlaying) {
      this.currentMusic.pause();
    }

    this.sounds.forEach(sound => {
      if (sound.isPlaying) {
        sound.pause();
      }
    });
  }

  /**
   * Resumes all paused sounds and music
   */
  resumeAll(): void {
    if (this.currentMusic && !this.currentMusic.isPlaying) {
      this.currentMusic.resume();
    }

    this.sounds.forEach(sound => {
      if (!sound.isPlaying && sound.isPaused) {
        sound.resume();
      }
    });
  }

  /**
   * Stops all currently playing sounds and music
   * @param fadeDuration - Fade out duration in milliseconds (0 = no fade)
   */
  stopAll(fadeDuration: number = 0): void {
    if (fadeDuration > 0) {
      this.scene.tweens.add({
        targets: [this.currentMusic, ...Array.from(this.sounds.values())],
        volume: 0,
        duration: fadeDuration,
        onComplete: () => {
          if (!this.scene?.scene?.isActive()) return;
          this.stopAll(0);
        }
      });
    } else {
      this.currentMusic?.stop();
      this.currentMusic = null;

      this.sounds.forEach(sound => {
        sound.stop();
      });
    }
  }

  /**
   * Gets the current sound configuration
   * @returns Copy of the current configuration
   */
  getConfig(): SoundConfig {
    return { ...this.config };
  }

  /**
   * Cleans up resources used by this manager
   */
  dispose(): void {
    this.volumeChangedUnsub?.();
    this.volumeChangedUnsub = undefined;

    this.stopAll();

    this.sounds.forEach(sound => sound.destroy());
    this.sounds.clear();

    this.music.forEach(music => music.destroy());
    this.music.clear();

    this.currentMusic = null;
  }
}
