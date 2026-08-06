import assert from 'node:assert/strict';
import { io as createClient, type Socket } from 'socket.io-client';
import type { RoomView } from '../src/lib/types';
import { buildInviteUrl } from '../src/lib/links';

type Ack = { ok: boolean; error?: string; roomCode?: string; resumeToken?: string; added?: number };

function emitAck(socket: Socket, event: string, payload: unknown): Promise<Ack> {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function nextState(socket: Socket, predicate: (state: RoomView) => boolean, timeoutMs = 4000) {
  return new Promise<RoomView>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error('Timeout waiting for room:state')); }, timeoutMs);
    const listener = (state: RoomView) => {
      if (!predicate(state)) return;
      cleanup(); resolve(state);
    };
    const cleanup = () => { clearTimeout(timer); socket.off('room:state', listener); };
    socket.on('room:state', listener);
  });
}

async function connect(baseUrl: string, cookie?: string) {
  const socket = createClient(baseUrl, {
    transports: ['websocket', 'polling'],
    forceNew: true,
    extraHeaders: cookie ? { Cookie: cookie } : undefined,
  });
  if (!socket.connected) await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
    socket.once('connect', () => { clearTimeout(timer); resolve(); });
    socket.once('connect_error', (error) => { clearTimeout(timer); reject(error); });
  });
  return socket;
}

const input = process.argv[2] || 'http://localhost:3000';
const baseUrl = new URL(input).origin;
const clients: Socket[] = [];
const log = (text: string) => console.log(`[PASS] ${text}`);

try {
  const home = await fetch(baseUrl, { redirect: 'manual' });
  assert.equal(home.status, 200);
  log(`HTTP home reachable: ${baseUrl}`);

  const runtimeConfig = await fetch(new URL('/api/runtime-config', baseUrl));
  assert.equal(runtimeConfig.status, 200);
  const runtimeJson = await runtimeConfig.json() as { publicOrigin?: string };
  assert.ok(runtimeJson.publicOrigin);
  log(`Runtime public origin available: ${runtimeJson.publicOrigin}`);

  const manifest = await fetch(new URL('/manifest.webmanifest', baseUrl));
  assert.equal(manifest.status, 200);
  const manifestJson = await manifest.json() as { display?: string };
  assert.ok(['fullscreen', 'standalone'].includes(manifestJson.display || ''));
  log(`PWA manifest reachable with display=${manifestJson.display}`);

  const sessionResponse = await fetch(new URL('/api/browser-session', baseUrl), { method: 'POST' });
  assert.equal(sessionResponse.status, 204);
  const hostCookie = (sessionResponse.headers.get('set-cookie') || '').split(';')[0];
  assert.match(hostCookie, /^taer_oti_session=[A-Za-z0-9_-]{43}$/);
  log('HttpOnly browser session endpoint issues a valid session cookie');

  const host = await connect(baseUrl, hostCookie); clients.push(host);
  const hostInitialState = nextState(host, (s) => s.participants.length === 1);
  const create = await emitAck(host, 'room:create', { name: `TestHost-${Date.now()}`, avatarId: 'senior-woman' });
  assert.equal(create.ok, true, create.error);
  assert.ok(create.roomCode && create.resumeToken);
  const hostState = await hostInitialState;
  assert.equal(hostState.participants.length, 1);
  assert.equal(hostState.participants[0].isHost, true);
  assert.equal(hostState.participants[0].avatarId, 'senior-woman');
  assert.ok(hostState.inviteToken);
  log('Host is created and visible in lobby');

  const inviteUrl = buildInviteUrl(baseUrl, hostState.inviteToken!);
  const parsedInvite = new URL(inviteUrl);
  assert.equal(parsedInvite.searchParams.has('room'), false);
  assert.equal(parsedInvite.searchParams.has('p'), false);
  assert.equal(parsedInvite.searchParams.get('invite'), hostState.inviteToken);
  const invitePage = await fetch(inviteUrl);
  assert.equal(invitePage.status, 200);
  log('Secure invite URL is valid and does not expose room/player identifiers');

  const guest = await connect(baseUrl); clients.push(guest);
  const hostSeesGuest = nextState(host, (s) => s.participants.length === 2);
  const join = await emitAck(guest, 'room:join', { invite: hostState.inviteToken, name: `Guest-${Date.now()}` });
  assert.equal(join.ok, true, join.error);
  const two = await hostSeesGuest;
  assert.equal(two.participants.length, 2);
  assert.equal(two.participants.filter((p) => p.isHost).length, 1);
  log('Joining through invite updates the original host screen');

  const duplicateHost = await connect(baseUrl, hostCookie); clients.push(duplicateHost);
  const duplicateStatePromise = nextState(duplicateHost, (state) => state.participants.length === 2);
  const reconnect = await emitAck(duplicateHost, 'room:resume-session', { code: create.roomCode });
  assert.equal(reconnect.ok, true, reconnect.error);
  const duplicateState = await duplicateStatePromise;
  assert.equal(duplicateState.self.id, hostState.self.id);
  assert.equal(duplicateState.participants.length, 2);
  const guest2 = await connect(baseUrl); clients.push(guest2);
  const originalHostStillUpdates = nextState(host, (s) => s.participants.length === 3);
  const join2 = await emitAck(guest2, 'room:join', { code: create.roomCode, name: `Guest2-${Date.now()}` });
  assert.equal(join2.ok, true, join2.error);
  await originalHostStillUpdates;
  log('Refresh/duplicate host session resumes the same participant and does not steal realtime updates');


  const guestDisconnected = nextState(host, (state) => Boolean(state.notice?.includes('Guest-')));
  guest.disconnect();
  const disconnectState = await guestDisconnected;
  assert.ok(disconnectState.notice);
  log('Host receives a realtime disconnect notice');

  const bad = await connect(baseUrl); clients.push(bad);
  const rejected = await emitAck(bad, 'room:join', { invite: `${hostState.inviteToken}broken`, name: 'BadInvite' });
  assert.equal(rejected.ok, false);
  log('Tampered invite token is rejected');

  console.log('\nAll live tests passed.');
} catch (error) {
  console.error('\nLIVE TEST FAILED');
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const socket of clients) socket.disconnect();
}
