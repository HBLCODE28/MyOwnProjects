import { io as createClient, type Socket } from 'socket.io-client';
import type { RoomView } from '../src/lib/types';
import { normalizeRoomCode, isRoomCode } from '../src/lib/room-code';
import { AVATARS } from '../src/lib/avatars';

type Ack = { ok: boolean; error?: string; roomCode?: string; resumeToken?: string };

function emitAck(socket: Socket, event: string, payload: unknown): Promise<Ack> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function isPrivateOrLocalHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '::1' || host === '[::1]' || host.startsWith('127.')) return true;
  if (host.startsWith('10.') || host.startsWith('192.168.')) return true;
  const match = host.match(/^172\.(\d{1,2})\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function randomItem<T>(items: readonly T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

const roomCode = normalizeRoomCode(process.argv[2] ?? '');
const requestedCount = Number.parseInt(process.argv[3] ?? '3', 10);
const baseUrl = new URL(process.argv[4] ?? 'http://localhost:3000');

if (!isRoomCode(roomCode)) {
  console.error('ERROR: Room code must contain 8 valid characters.');
  process.exit(1);
}
if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 20) {
  console.error('ERROR: Test player count must be between 1 and 20.');
  process.exit(1);
}
if (!['http:', 'https:'].includes(baseUrl.protocol) || !isPrivateOrLocalHost(baseUrl.hostname)) {
  console.error('ERROR: This helper only connects to localhost or a private LAN address.');
  process.exit(1);
}

const sockets: Socket[] = [];
let shuttingDown = false;

async function createBot(index: number) {
  const socket = createClient(baseUrl.origin, {
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: true,
  });
  sockets.push(socket);

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Connection timeout')), 6000);
    socket.once('connect', () => { clearTimeout(timer); resolve(); });
    socket.once('connect_error', (error) => { clearTimeout(timer); reject(error); });
  });

  const name = `בדיקה ${index}`;
  const avatarId = randomItem(AVATARS).id;
  const joined = await emitAck(socket, 'room:join', { code: roomCode, name, avatarId });
  if (!joined.ok) {
    socket.disconnect();
    throw new Error(`${name}: ${joined.error ?? 'join failed'}`);
  }

  let lastReadyRound = -1;
  let lastGuessTurnKey = '';
  let actionInFlight = false;

  socket.on('room:state', async (state: RoomView) => {
    if (actionInFlight || shuttingDown) return;

    if (state.phase === 'prep' && !state.self.prepReady && lastReadyRound !== state.roundNumber) {
      actionInFlight = true;
      lastReadyRound = state.roundNumber;
      try {
        await emitAck(socket, 'game:prep-ready', {});
      } finally {
        actionInFlight = false;
      }
      return;
    }

    if (state.phase !== 'turn' || !state.currentDescriber) return;
    if (state.currentDescriber.id === state.self.id || state.self.selectedGuessId) return;

    const turnKey = `${state.roundNumber}:${state.currentDescriber.id}`;
    if (lastGuessTurnKey === turnKey) return;

    const used = new Set(state.self.usedGuessTargetIds);
    const candidates = state.participants.filter((player) =>
      player.connected
      && player.id !== state.currentDescriber?.id
      && player.id !== state.self.assignedTargetId
      && !used.has(player.id),
    );
    if (!candidates.length) return;

    lastGuessTurnKey = turnKey;
    actionInFlight = true;
    try {
      // Small randomized delay makes local test players behave more like separate phones.
      await new Promise((resolve) => setTimeout(resolve, 150 + Math.floor(Math.random() * 700)));
      const target = randomItem(candidates);
      const guessed = await emitAck(socket, 'game:guess', { targetId: target.id });
      if (!guessed.ok && !/כבר|סגורים|אי אפשר/.test(guessed.error ?? '')) {
        console.warn(`[${name}] guess rejected: ${guessed.error}`);
      }
    } finally {
      actionInFlight = false;
    }
  });

  // Request a fresh state after the listener is installed so the last bot in the batch
  // does not depend on another participant action to receive its first room state.
  await emitAck(socket, 'room:sync', {});

  console.log(`[OK] ${name} joined (${avatarId})`);
}

try {
  console.log(`Connecting ${requestedCount} local test player(s) to room ${roomCode} at ${baseUrl.origin}...`);
  for (let i = 1; i <= requestedCount; i++) {
    await createBot(i);
  }
  console.log('');
  console.log('Test players are active. They will mark ready and guess randomly.');
  console.log('Keep this window open. Press Ctrl+C to disconnect all test players.');
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  for (const socket of sockets) socket.disconnect();
  process.exit(1);
}

const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nDisconnecting local test players...');
  for (const socket of sockets) socket.disconnect();
  setTimeout(() => process.exit(0), 50).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
