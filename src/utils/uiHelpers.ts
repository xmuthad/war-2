export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function getFactionIcon(faction: string): string {
  const icons: Record<string, string> = {
    usa: '🇺🇸',
    britain: '🇬🇧',
    germany: '🇩🇪',
    france: '🇫🇷',
    korea: '🇰🇷',
    soviet: '☭',
    cuba: '🏴',
    libya: '🏜️',
    iraq: '🌙',
    neutral: '🏳️',
  };
  return icons[faction.toLowerCase()] || '🏳️';
}

export function getDifficultyColor(difficulty: string): string {
  const colors: Record<string, string> = {
    easy: '#44FF44',
    normal: '#FFFF44',
    hard: '#FF8844',
    brutal: '#FF4444',
  };
  return colors[difficulty.toLowerCase()] || '#FFFFFF';
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}
