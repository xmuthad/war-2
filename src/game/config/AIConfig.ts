export const AI_CONFIG = {
  // Tick intervals by difficulty (ms)
  TICK_INTERVALS: {
    easy: 2000,
    normal: 1000,
    hard: 500,
    brutal: 250,
  },
  // Difficulty multipliers for production speed (higher = faster)
  PRODUCTION_SPEED: {
    easy: 0.6,
    normal: 1.0,
    hard: 1.5,
    brutal: 2.0,
  },
  // Difficulty multipliers for attack wave cooldown (higher = shorter cooldown = more frequent)
  WAVE_FREQUENCY: {
    easy: 0.7,
    normal: 1.2,
    hard: 1.6,
    brutal: 2.2,
  },
  // Difficulty multipliers for attack wave size ratio
  WAVE_SIZE_RATIO: {
    easy: 0.3,
    normal: 0.45,
    hard: 0.55,
    brutal: 0.65,
  },
  // Difficulty multipliers for min wave size
  WAVE_MIN_SIZE: {
    easy: 2,
    normal: 2,
    hard: 3,
    brutal: 4,
  },
  // Difficulty multipliers for building construction speed
  BUILD_SPEED: {
    easy: 0.5,
    normal: 1.0,
    hard: 1.5,
    brutal: 2.0,
  },
  // Threat assessment
  THREAT_DISTANCE: 500,
  DEFENSE_DISTANCE: 300,
  LOW_HEALTH_THRESHOLD: 0.7,
  // Unit behavior
  SCATTER_DISTANCE_MIN: 150,
  SCATTER_DISTANCE_RANGE: 100,
  PATROL_RADIUS: 200,
  // Economy
  DESIRED_MINER_COUNT: 3,
  LOW_MONEY_THRESHOLD: 500,
  REPAIR_COST_THRESHOLD: 100,
  // Production probabilities
  PRODUCTION_PROBABILITY_LOW: 0.6,
  PRODUCTION_PROBABILITY_HIGH: 0.8,
} as const;
