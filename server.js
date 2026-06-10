/**
 * WebSocket server for Red Alert 2-style multiplayer.
 * Implements deterministic lockstep synchronization.
 *
 * Usage: node server.js [--port 8080]
 */
import { WebSocketServer, WebSocket } from 'ws';

interface Room {
  id: string;
  players: PlayerConnection[];
  maxPlayers: number;
  turn: number;
  commands: Map<number, Command[]>; // turn -> commands
  readyPlayers: Set<string>;
  gameState: 'waiting' | 'playing' | 'finished';
  mapId?: string;
  hostId: string;
}

interface PlayerConnection {
  id: string;
  name: string;
  faction: string;
  ws: WebSocket;
  ready: boolean;
}

interface Command {
  playerId: string;
  type: string;
  data: Record<string, unknown>;
  turn: number;
}

interface RoomListEntry {
  id: string;
  playerCount: number;
  maxPlayers: number;
  gameState: string;
  mapId?: string;
  hostName: string;
}

const rooms = new Map<string, Room>();
const playerRooms = new Map<string, string>(); // playerId -> roomId

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function broadcastToRoom(room: Room, message: object, excludeId?: string): void {
  const data = JSON.stringify(message);
  for (const player of room.players) {
    if (player.id !== excludeId && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(data);
    }
  }
}

function getRoomList(): RoomListEntry[] {
  const list: RoomListEntry[] = [];
  for (const room of rooms.values()) {
    const host = room.players.find(p => p.id === room.hostId);
    list.push({
      id: room.id,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      gameState: room.gameState,
      mapId: room.mapId,
      hostName: host?.name ?? 'Unknown',
    });
  }
  return list;
}

function removePlayerFromRoom(playerId: string): void {
  const roomId = playerRooms.get(playerId);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  room.players = room.players.filter(p => p.id !== playerId);
  room.readyPlayers.delete(playerId);
  playerRooms.delete(playerId);

  if (room.players.length === 0) {
    rooms.delete(roomId);
    return;
  }

  // If host left, transfer host
  if (room.hostId === playerId) {
    room.hostId = room.players[0].id;
  }

  broadcastToRoom(room, {
    type: 'player_left',
    playerId,
    hostId: room.hostId,
    players: room.players.map(p => ({ id: p.id, name: p.name, faction: p.faction, ready: p.ready })),
  });
}

function handleMessage(ws: WebSocket, raw: string): void {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(raw);
  } catch {
    ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
    return;
  }

  const type = msg.type as string;
  const playerId = msg.playerId as string;

  switch (type) {
    case 'create_room': {
      const maxPlayers = (msg.maxPlayers as number) || 2;
      const mapId = msg.mapId as string | undefined;
      const name = (msg.name as string) || 'Player';
      const faction = (msg.faction as string) || 'allies';

      const roomId = generateId();
      const room: Room = {
        id: roomId,
        players: [{ id: playerId, name, faction, ws, ready: false }],
        maxPlayers,
        turn: 0,
        commands: new Map(),
        readyPlayers: new Set(),
        gameState: 'waiting',
        mapId,
        hostId: playerId,
      };
      rooms.set(roomId, room);
      playerRooms.set(playerId, roomId);

      ws.send(JSON.stringify({
        type: 'room_created',
        roomId,
        hostId: playerId,
      }));
      break;
    }

    case 'join_room': {
      const roomId = msg.roomId as string;
      const name = (msg.name as string) || 'Player';
      const faction = (msg.faction as string) || 'allies';

      const room = rooms.get(roomId);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
      }
      if (room.players.length >= room.maxPlayers) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
        return;
      }
      if (room.gameState !== 'waiting') {
        ws.send(JSON.stringify({ type: 'error', message: 'Game already in progress' }));
        return;
      }

      room.players.push({ id: playerId, name, faction, ws, ready: false });
      playerRooms.set(playerId, roomId);

      ws.send(JSON.stringify({
        type: 'room_joined',
        roomId,
        players: room.players.map(p => ({ id: p.id, name: p.name, faction: p.faction, ready: p.ready })),
        hostId: room.hostId,
      }));

      broadcastToRoom(room, {
        type: 'player_joined',
        playerId,
        name,
        faction,
        players: room.players.map(p => ({ id: p.id, name: p.name, faction: p.faction, ready: p.ready })),
      }, playerId);
      break;
    }

    case 'list_rooms': {
      ws.send(JSON.stringify({ type: 'room_list', rooms: getRoomList() }));
      break;
    }

    case 'ready': {
      const roomId = playerRooms.get(playerId);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      const player = room.players.find(p => p.id === playerId);
      if (player) player.ready = !player.ready;

      if (player?.ready) {
        room.readyPlayers.add(playerId);
      } else {
        room.readyPlayers.delete(playerId);
      }

      broadcastToRoom(room, {
        type: 'player_ready',
        playerId,
        ready: player?.ready,
        players: room.players.map(p => ({ id: p.id, name: p.name, faction: p.faction, ready: p.ready })),
      });

      // If all players ready and at least 2, start game
      if (room.players.length >= 2 && room.players.every(p => p.ready)) {
        room.gameState = 'playing';
        room.turn = 0;
        broadcastToRoom(room, {
          type: 'game_start',
          turn: 0,
          players: room.players.map(p => ({ id: p.id, name: p.name, faction: p.faction })),
          mapId: room.mapId,
        });
      }
      break;
    }

    case 'command': {
      const roomId = playerRooms.get(playerId);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room || room.gameState !== 'playing') return;

      const turn = msg.turn as number;
      const command: Command = {
        playerId,
        type: msg.commandType as string,
        data: (msg.data as Record<string, unknown>) || {},
        turn,
      };

      if (!room.commands.has(turn)) {
        room.commands.set(turn, []);
      }
      room.commands.get(turn)!.push(command);

      // Broadcast command to all other players
      broadcastToRoom(room, {
        type: 'command',
        command,
      }, playerId);

      // Check if all players have submitted commands for this turn
      const turnCommands = room.commands.get(turn) || [];
      const playersWithCommands = new Set(turnCommands.map(c => c.playerId));
      if (playersWithCommands.size === room.players.length) {
        // All players submitted - advance turn
        broadcastToRoom(room, {
          type: 'turn_complete',
          turn,
          commands: turnCommands,
        });

        // Clean up old turns (keep last 10)
        for (const t of room.commands.keys()) {
          if (t < turn - 10) {
            room.commands.delete(t);
          }
        }

        room.turn = turn + 1;
      }
      break;
    }

    case 'chat': {
      const roomId = playerRooms.get(playerId);
      if (!roomId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      broadcastToRoom(room, {
        type: 'chat',
        playerId,
        message: msg.message,
        timestamp: Date.now(),
      });
      break;
    }

    case 'leave_room': {
      removePlayerFromRoom(playerId);
      ws.send(JSON.stringify({ type: 'room_left' }));
      break;
    }

    case 'ping': {
      ws.send(JSON.stringify({ type: 'pong', timestamp: msg.timestamp }));
      break;
    }
  }
}

// Main server setup
const port = parseInt(process.argv.find(a => a.startsWith('--port'))?.split('=')[1] || '8080', 10);

const wss = new WebSocketServer({ port });

wss.on('connection', (ws) => {
  const playerId = generateId();

  ws.send(JSON.stringify({ type: 'connected', playerId }));

  ws.on('message', (data) => {
    handleMessage(ws, data.toString());
  });

  ws.on('close', () => {
    removePlayerFromRoom(playerId);
  });

  ws.on('error', () => {
    removePlayerFromRoom(playerId);
  });
});

console.log(`War Game Multiplayer Server running on ws://localhost:${port}`);
