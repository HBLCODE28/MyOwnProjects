import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { io as createClient, type Socket } from 'socket.io-client';
import { attachGameSocketServer } from '../src/server/socket-server';
import type { RoomView } from '../src/lib/types';

type Ack = { ok: boolean; error?: string; roomCode?: string; resumeToken?: string };

function emitAck(socket: Socket, event: string, payload: unknown): Promise<Ack> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function nextState(socket: Socket, predicate: (state: RoomView) => boolean, timeoutMs = 1500) {
  return new Promise<RoomView>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('Timed out waiting for room:state')); }, timeoutMs);
    const listener = (state: RoomView) => {
      if (!predicate(state)) return;
      cleanup(); resolve(state);
    };
    const cleanup = () => { clearTimeout(timer); socket.off('room:state', listener); };
    socket.on('room:state', listener);
  });
}

test('socket flow: secure invite join updates host and preserves host across duplicate reconnect', async () => {
  const http = createServer((_req, res) => { res.statusCode = 200; res.end('ok'); });
  const gameServer = attachGameSocketServer(http, { timings: { prepMs: 10, turnMs: 5, reconnectGraceMs: 25 } });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const clients: Socket[] = [];
  const connect = async (cookie?: string) => {
    const socket = createClient(base, {
      transports: ['websocket'],
      forceNew: true,
      extraHeaders: cookie ? { Cookie: cookie } : undefined,
    });
    clients.push(socket);
    if (!socket.connected) await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return socket;
  };

  try {
    const host = await connect();
    const createState = nextState(host, (s) => s.participants.length === 1);
    const created = await emitAck(host, 'room:create', { name: 'Host' });
    assert.equal(created.ok, true);
    assert.ok(created.roomCode && created.resumeToken);
    const hostState = await createState;
    assert.equal(hostState.participants[0].isHost, true);
    assert.ok(hostState.inviteToken);

    const guest = await connect();
    const hostSeesGuest = nextState(host, (s) => s.participants.length === 2);
    const guestStatePromise = nextState(guest, (s) => s.participants.length === 2);
    const joined = await emitAck(guest, 'room:join', { invite: hostState.inviteToken, name: 'Guest' });
    assert.equal(joined.ok, true);
    const updatedHost = await hostSeesGuest;
    const guestState = await guestStatePromise;
    assert.deepEqual(updatedHost.participants.map((p) => p.name).sort(), ['Guest', 'Host']);
    assert.equal(updatedHost.participants.find((p) => p.name === 'Host')?.isHost, true);
    assert.equal(guestState.inviteToken, null);

    const duplicateHost = await connect();
    const duplicateState = nextState(duplicateHost, (s) => s.participants.length === 2);
    const reconnected = await emitAck(duplicateHost, 'room:reconnect', { code: created.roomCode, resumeToken: created.resumeToken });
    assert.equal(reconnected.ok, true);
    await duplicateState;

    const guest2 = await connect();
    const originalHostStillUpdates = nextState(host, (s) => s.participants.length === 3);
    const joined2 = await emitAck(guest2, 'room:join', { code: created.roomCode, name: 'Guest2' });
    assert.equal(joined2.ok, true);
    const three = await originalHostStillUpdates;
    assert.equal(three.participants.length, 3);
    assert.equal(three.participants.filter((p) => p.isHost).length, 1);

    const attacker = await connect();
    const rejected = await emitAck(attacker, 'room:join', { invite: `${hostState.inviteToken}tamper`, name: 'Nope' });
    assert.equal(rejected.ok, false);
  } finally {
    for (const c of clients) c.disconnect();
    await gameServer.close();
    await new Promise<void>((resolve) => http.close(() => resolve()));
  }
});

test('socket flow: the same browser session cannot join the same room twice', async () => {
  const http = createServer((_req, res) => { res.statusCode = 200; res.end('ok'); });
  const gameServer = attachGameSocketServer(http, { timings: { prepMs: 20, turnMs: 10, reconnectGraceMs: 30 } });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const session = 'A'.repeat(43);
  const cookie = `taer_oti_session=${session}`;
  const clients: Socket[] = [];
  const connect = async () => {
    const socket = createClient(base, { transports: ['websocket'], forceNew: true, extraHeaders: { Cookie: cookie } });
    clients.push(socket);
    if (!socket.connected) await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  };

  try {
    const first = await connect();
    const firstStatePromise = nextState(first, (s) => s.participants.length === 1);
    const created = await emitAck(first, 'room:create', { name: 'Host' });
    assert.equal(created.ok, true);
    const firstState = await firstStatePromise;
    assert.equal(firstState.participants.length, 1);

    const second = await connect();
    const joinedDifferentName = await emitAck(second, 'room:join', { code: created.roomCode, name: 'Another person' });
    assert.equal(joinedDifferentName.ok, false);
    assert.match(joinedDifferentName.error || '', /כבר מחובר/);

    const secondStatePromise = nextState(second, (s) => s.participants.length === 1);
    const joinedSameName = await emitAck(second, 'room:join', { code: created.roomCode, name: 'Host' });
    assert.equal(joinedSameName.ok, true);
    const secondState = await secondStatePromise;
    assert.equal(secondState.participants.length, 1);
    assert.equal(secondState.self.id, firstState.self.id);
    assert.equal(secondState.self.name, 'Host');

    const syncStatePromise = nextState(first, (s) => s.participants.length === 1);
    const synced = await emitAck(first, 'room:sync', {});
    assert.equal(synced.ok, true);
    await syncStatePromise;
  } finally {
    for (const c of clients) c.disconnect();
    await gameServer.close();
    await new Promise<void>((resolve) => http.close(() => resolve()));
  }
});

test('host disconnect transfers management to the next participant instead of closing the room', async () => {
  const http = createServer((_req, res) => { res.statusCode = 200; res.end('ok'); });
  const gameServer = attachGameSocketServer(http, { timings: { prepMs: 100, turnMs: 100, reconnectGraceMs: 20, hostTransferGraceMs: 35 } });
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const clients: Socket[] = [];
  const connect = async () => {
    const socket = createClient(base, { transports: ['websocket'], forceNew: true });
    clients.push(socket);
    if (!socket.connected) await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    return socket;
  };

  try {
    const host = await connect();
    const created = await emitAck(host, 'room:create', { name: 'Host' });
    assert.equal(created.ok, true);
    assert.ok(created.roomCode);
    const room = gameServer.games.getRoom(created.roomCode)!;
    const invite = room.inviteToken;

    const guest = await connect();
    const guestStatePromise = nextState(guest, (state) => state.participants.length === 2);
    const joined = await emitAck(guest, 'room:join', { invite, name: 'Guest' });
    assert.equal(joined.ok, true);
    await guestStatePromise;

    const promoted = nextState(guest, (state) => state.self.isHost === true);
    host.disconnect();
    const promotedState = await promoted;
    assert.equal(promotedState.self.name, 'Guest');
    assert.equal(promotedState.self.isHost, true);
    assert.match(promotedState.notice || '', /ניהול/);
    assert.equal(gameServer.games.getRoom(created.roomCode), room);
    assert.equal(room.host?.id, promotedState.self.id);
  } finally {
    for (const client of clients) client.disconnect();
    await gameServer.close();
    await new Promise<void>((resolve) => http.close(() => resolve()));
  }
});


test('manual room code rejects brute-force attempts after repeated failures', async () => {
  const http = createServer((_req, res) => { res.statusCode = 200; res.end('ok'); });
  const gameServer = attachGameSocketServer(http);
  await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
  const address = http.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  const client = createClient(base, { transports: ['websocket'], forceNew: true });
  if (!client.connected) await new Promise<void>((resolve, reject) => {
    client.once('connect', resolve);
    client.once('connect_error', reject);
  });

  try {
    for (let i = 0; i < 8; i++) {
      const failed = await emitAck(client, 'room:join', { code: 'ABCDEFGH', name: 'Nope' });
      assert.equal(failed.ok, false);
      assert.match(failed.error || '', /שגוי|לא קיים/);
    }
    const blocked = await emitAck(client, 'room:join', { code: 'ABCDEFGH', name: 'Nope' });
    assert.equal(blocked.ok, false);
    assert.match(blocked.error || '', /יותר מדי ניסיונות/);
  } finally {
    client.disconnect();
    await gameServer.close();
    await new Promise<void>((resolve) => http.close(() => resolve()));
  }
});
