import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { Server } from 'socket.io';
import { GameManager, type Room, DEFAULT_TIMINGS, type Timings } from './game';
import { readBrowserSessionId } from './browser-session';
import { isRoomCode, normalizeRoomCode } from '../lib/room-code';

type SocketServerOptions = {
  timings?: Partial<Timings>;
};

const JOIN_ATTEMPT_WINDOW_MS = 60_000;
const MAX_FAILED_CODE_ATTEMPTS = 8;

type AttemptBucket = number[];

function pruneAttempts(attempts: AttemptBucket, now = Date.now()) {
  const cutoff = now - JOIN_ATTEMPT_WINDOW_MS;
  while (attempts.length && attempts[0] < cutoff) attempts.shift();
  return attempts;
}

function sameOriginRequest(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function attachGameSocketServer(httpServer: HttpServer, options: SocketServerOptions = {}) {
  let io: Server;
  const failedJoinAttempts = new Map<string, AttemptBucket>();

  const joinAttemptKey = (address: string) => address || 'unknown';
  const ensureJoinAttemptAllowed = (key: string) => {
    const attempts = pruneAttempts(failedJoinAttempts.get(key) ?? []);
    if (attempts.length >= MAX_FAILED_CODE_ATTEMPTS) {
      failedJoinAttempts.set(key, attempts);
      throw new Error('יותר מדי ניסיונות קוד שגויים. נסו שוב בעוד דקה.');
    }
    if (attempts.length) failedJoinAttempts.set(key, attempts);
    else failedJoinAttempts.delete(key);
  };
  const recordFailedJoinAttempt = (key: string) => {
    const attempts = pruneAttempts(failedJoinAttempts.get(key) ?? []);
    attempts.push(Date.now());
    failedJoinAttempts.set(key, attempts);
  };
  const clearFailedJoinAttempts = (key: string) => failedJoinAttempts.delete(key);
  const emitRoomState = (room: Room) => {
    for (const { playerId, socketId } of room.socketIds()) {
      try {
        io.to(socketId).emit('room:state', room.buildView(playerId));
      } catch {
        // A stale socket is harmless; reconnect will refresh the full state.
      }
    }
  };

  const games = new GameManager(emitRoomState, { ...DEFAULT_TIMINGS, ...options.timings });
  io = new Server(httpServer, {
    cors: { origin: true, credentials: false },
    allowRequest: (req, callback) => callback(null, sameOriginRequest(req)),
    maxHttpBufferSize: 64 * 1024,
    pingInterval: 3_000,
    pingTimeout: 3_000,
  });

  const cleanupTimer = setInterval(() => games.cleanup(), 30 * 60 * 1000);
  cleanupTimer.unref();
  const attemptCleanupTimer = setInterval(() => {
    for (const [key, attempts] of failedJoinAttempts) {
      if (!pruneAttempts(attempts).length) failedJoinAttempts.delete(key);
    }
  }, JOIN_ATTEMPT_WINDOW_MS);
  attemptCleanupTimer.unref();

  io.on('connection', (socket) => {
    const browserSessionId = readBrowserSessionId(socket.request);
    const succeed = (cb: unknown, payload: unknown) => typeof cb === 'function' && cb({ ok: true, ...payload as object });
    const fail = (cb: unknown, error: unknown) => {
      const message = error instanceof Error ? error.message : 'אירעה שגיאה.';
      if (typeof cb === 'function') cb({ ok: false, error: message });
    };

    socket.on('room:create', ({ name, avatarId }, cb) => {
      try {
        const { room, player } = games.createRoom(String(name ?? ''), socket.id, browserSessionId, avatarId);
        socket.data.roomCode = room.code;
        socket.data.playerId = player.id;
        socket.join(room.code);
        succeed(cb, { roomCode: room.code, resumeToken: player.resumeToken });
        console.log(`[room ${room.code}] created by ${player.name}; participants=${room.players.length}`);
        emitRoomState(room);
      } catch (error) { fail(cb, error); }
    });

    socket.on('room:join', ({ code, invite, name, avatarId }, cb) => {
      try {
        const joiningByInvite = Boolean(invite);
        const attemptKey = joinAttemptKey(browserSessionId || socket.handshake.address);
        let room: Room | null;
        if (joiningByInvite) {
          room = games.getRoomByInvite(String(invite));
        } else {
          ensureJoinAttemptAllowed(attemptKey);
          const normalizedCode = normalizeRoomCode(code);
          if (!isRoomCode(normalizedCode)) {
            recordFailedJoinAttempt(attemptKey);
            throw new Error('קוד החדר אינו תקין. בדקו את 8 התווים ונסו שוב.');
          }
          room = games.getRoom(normalizedCode);
          if (!room) {
            recordFailedJoinAttempt(attemptKey);
            throw new Error('קוד החדר שגוי או שהחדר כבר לא קיים.');
          }
          clearFailedJoinAttempts(attemptKey);
        }
        if (!room) throw new Error('החדר לא נמצא או שקישור ההזמנה אינו תקין.');
        const existing = room.findPlayerByBrowserSession(browserSessionId);
        if (existing) {
          const requestedName = String(name ?? '').trim().replace(/\s+/g, ' ');
          if (requestedName && requestedName.toLocaleLowerCase('he') !== existing.name.toLocaleLowerCase('he')) {
            throw new Error(`הדפדפן הזה כבר מחובר לחדר בשם ${existing.name}. כדי למנוע כניסה כפולה, רענון או טאב נוסף מתחברים לאותו משתתף.`);
          }
        }
        const player = existing
          ? room.reconnectBrowserSession(browserSessionId, socket.id)
          : room.addPlayer(String(name ?? ''), false, socket.id, browserSessionId, avatarId);
        socket.data.roomCode = room.code;
        socket.data.playerId = player.id;
        socket.join(room.code);
        succeed(cb, { roomCode: room.code, resumeToken: player.resumeToken });
        console.log(`[room ${room.code}] joined/resumed ${player.name}; participants=${room.players.length}`);
        emitRoomState(room);
      } catch (error) { fail(cb, error); }
    });

    socket.on('room:resume-session', ({ code, invite }, cb) => {
      try {
        if (!browserSessionId) throw new Error('לא נמצאה session בדפדפן.');
        const room = invite
          ? games.getRoomByInvite(String(invite))
          : games.getRoom(normalizeRoomCode(code));
        if (!room) throw new Error('החדר לא נמצא.');
        const player = room.reconnectBrowserSession(browserSessionId, socket.id);
        socket.data.roomCode = room.code;
        socket.data.playerId = player.id;
        socket.join(room.code);
        succeed(cb, { roomCode: room.code, resumeToken: player.resumeToken });
        emitRoomState(room);
      } catch (error) { fail(cb, error); }
    });

    socket.on('room:reconnect', ({ code, resumeToken }, cb) => {
      try {
        const room = games.getRoom(normalizeRoomCode(code));
        if (!room) throw new Error('החדר כבר לא קיים.');
        const player = room.reconnect(String(resumeToken ?? ''), socket.id);
        socket.data.roomCode = room.code;
        socket.data.playerId = player.id;
        socket.join(room.code);
        succeed(cb, { roomCode: room.code, resumeToken: player.resumeToken });
        emitRoomState(room);
      } catch (error) { fail(cb, error); }
    });

    socket.on('room:sync', (_, cb) => {
      try {
        const room = games.getRoom(socket.data.roomCode);
        const playerId = socket.data.playerId;
        if (!room || !playerId) throw new Error('החדר לא נמצא.');
        socket.emit('room:state', room.buildView(playerId));
        succeed(cb, { participantCount: room.players.length });
      } catch (error) { fail(cb, error); }
    });

    socket.on('room:set-rounds', ({ rounds }, cb) => {
      try {
        const room = games.getRoom(socket.data.roomCode);
        if (!room) throw new Error('החדר לא נמצא.');
        room.setRounds(socket.data.playerId, Number(rounds));
        succeed(cb, {});
      } catch (error) { fail(cb, error); }
    });


    socket.on('game:start', (_, cb) => {
      try {
        const room = games.getRoom(socket.data.roomCode);
        if (!room) throw new Error('החדר לא נמצא.');
        room.startGame(socket.data.playerId);
        succeed(cb, {});
      } catch (error) { fail(cb, error); }
    });

    socket.on('game:next-round', (_, cb) => {
      try {
        const room = games.getRoom(socket.data.roomCode);
        if (!room) throw new Error('החדר לא נמצא.');
        room.startNextRound(socket.data.playerId);
        succeed(cb, {});
      } catch (error) { fail(cb, error); }
    });

    socket.on('game:prep-ready', (_, cb) => {
      try {
        const room = games.getRoom(socket.data.roomCode);
        if (!room) throw new Error('החדר לא נמצא.');
        room.markPrepReady(socket.data.playerId);
        succeed(cb, {});
      } catch (error) { fail(cb, error); }
    });

    socket.on('game:new', (_, cb) => {
      try {
        const room = games.getRoom(socket.data.roomCode);
        if (!room) throw new Error('החדר לא נמצא.');
        room.newGame(socket.data.playerId);
        succeed(cb, {});
      } catch (error) { fail(cb, error); }
    });

    socket.on('game:guess', ({ targetId }, cb) => {
      try {
        const room = games.getRoom(socket.data.roomCode);
        if (!room) throw new Error('החדר לא נמצא.');
        room.guess(socket.data.playerId, String(targetId ?? ''));
        succeed(cb, {});
      } catch (error) { fail(cb, error); }
    });

    socket.on('notice:clear', (_, cb) => {
      try {
        const room = games.getRoom(socket.data.roomCode);
        if (!room) throw new Error('החדר לא נמצא.');
        room.clearNotice(socket.data.playerId);
        succeed(cb, {});
      } catch (error) { fail(cb, error); }
    });

    socket.on('disconnect', () => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;
      if (!roomCode || !playerId) return;
      const room = games.getRoom(roomCode);
      if (!room) return;
      room.disconnect(playerId, socket.id, () => {
        const expiredPlayer = room.players.find((p) => p.id === playerId);
        if (!expiredPlayer || expiredPlayer.connected) return;
        if (expiredPlayer.isHost) {
          const successor = room.transferHostFromDisconnected(playerId);
          if (successor) console.log(`[room ${room.code}] host transferred to ${successor.name}`);
          emitRoomState(room);
          return;
        }
        room.removeDisconnectedPlayer(playerId);
        emitRoomState(room);
      });
    });
  });

  return {
    io,
    games,
    close: async () => {
      clearInterval(cleanupTimer);
      clearInterval(attemptCleanupTimer);
      for (const room of games.rooms.values()) room.destroy();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    },
  };
}
