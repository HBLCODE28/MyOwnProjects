import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TIMINGS, GameManager } from '../src/server/game';

const waitUntil = async (fn: () => boolean, timeoutMs = 1500) => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error('Timed out waiting for game state');
};

test('host is a visible participant from room creation', () => {
  const manager = new GameManager(() => undefined);
  const { room, player } = manager.createRoom('Dana', 'socket-host');
  const view = room.buildView(player.id);
  assert.equal(view.participants.length, 1);
  assert.equal(view.participants[0].name, 'Dana');
  assert.equal(view.participants[0].isHost, true);
  assert.equal(view.self.isHost, true);
  assert.ok(view.inviteToken);
  assert.equal(view.inviteToken?.length, 43);
  assert.equal(room.code.length, 8);
  assert.match(room.code, /^[A-HJ-NP-Z2-9]{8}$/);
});

test('game requires at least four participants to start', () => {
  const manager = new GameManager(() => undefined);
  const { room, player: host } = manager.createRoom('Host', 's1');
  room.addPlayer('P2', false, 's2');
  room.addPlayer('P3', false, 's3');
  assert.equal(room.buildView(host.id).minPlayers, 4);
  assert.equal(room.buildView(host.id).canStart, false);
  assert.throws(() => room.startGame(host.id), /לפחות 4/);
  room.addPlayer('P4', false, 's4');
  assert.equal(room.buildView(host.id).canStart, true);
  room.destroy();
});

test('getRoom is safe for missing values and invite lookup is exact', () => {
  const manager = new GameManager(() => undefined);
  const { room } = manager.createRoom('Host', 's1');
  assert.equal(manager.getRoom(undefined), null);
  assert.equal(manager.getRoom(null), null);
  assert.equal(manager.getRoom(''), null);
  assert.equal(manager.getRoom(room.code.toLowerCase()), room);
  assert.equal(manager.getRoomByInvite(room.inviteToken), room);
  assert.equal(manager.getRoomByInvite(`${room.inviteToken}x`), null);
  assert.equal(manager.getRoomByInvite('short'), null);
});

test('duplicate tabs do not steal the host connection', () => {
  const manager = new GameManager(() => undefined, { prepMs: 20, turnMs: 10, reconnectGraceMs: 30 });
  const { room, player } = manager.createRoom('Host', 'socket-a');
  room.reconnect(player.resumeToken, 'socket-b');
  assert.deepEqual(new Set(room.socketIds().map((x) => x.socketId)), new Set(['socket-a', 'socket-b']));
  room.disconnect(player.id, 'socket-b', () => room.removeDisconnectedPlayer(player.id));
  assert.equal(room.buildView(player.id).participants[0].connected, true);
  assert.deepEqual(room.socketIds().map((x) => x.socketId), ['socket-a']);
});

test('three rounds with four players produce all 12 unique directed pairings', async () => {
  const manager = new GameManager(() => undefined, { prepMs: 5, turnMs: 3, reconnectGraceMs: 20 });
  const { room, player: host } = manager.createRoom('Host', 's1');
  room.addPlayer('P2', false, 's2');
  room.addPlayer('P3', false, 's3');
  room.addPlayer('P4', false, 's4');
  room.setRounds(host.id, 3);
  room.startGame(host.id);

  for (let round = 1; round <= 3; round++) {
    await waitUntil(() => room.phase === (round === 3 ? 'final' : 'roundResults'));
    if (round < 3) room.startNextRound(host.id);
  }

  assert.equal(room.rounds.length, 3);
  const keys = room.rounds.flatMap((r) => r.pairs.map((p) => `${p.describerId}:${p.targetId}`));
  assert.equal(keys.length, 12);
  assert.equal(new Set(keys).size, 12);
  assert.ok(room.rounds.every((r) => r.pairs.every((p) => p.describerId !== p.targetId)));
  assert.ok(room.players.every((p) => p.score === 9));
});

test('browser session reconnects to the same player instead of creating a duplicate', () => {
  const manager = new GameManager(() => undefined);
  const browserSessionId = 'browser-session-a';
  const { room, player } = manager.createRoom('Host', 'socket-a', browserSessionId);
  assert.equal(room.findPlayerByBrowserSession(browserSessionId)?.id, player.id);
  const resumed = room.reconnectBrowserSession(browserSessionId, 'socket-b');
  assert.equal(resumed.id, player.id);
  assert.equal(room.players.length, 1);
  assert.deepEqual(new Set(room.socketIds().map((x) => x.socketId)), new Set(['socket-a', 'socket-b']));
});

test('all players can end prep early by marking ready', () => {
  const manager = new GameManager(() => undefined, { prepMs: 10_000, turnMs: 10_000, reconnectGraceMs: 100 });
  const { room, player: host } = manager.createRoom('Host', 's1');
  const p2 = room.addPlayer('P2', false, 's2');
  const p3 = room.addPlayer('P3', false, 's3');
  const p4 = room.addPlayer('P4', false, 's4');
  room.startGame(host.id);
  assert.equal(room.phase, 'prep');
  room.markPrepReady(host.id);
  room.markPrepReady(p2.id);
  room.markPrepReady(p3.id);
  assert.equal(room.phase, 'prep');
  room.markPrepReady(p4.id);
  assert.equal(room.phase, 'turn');
  assert.equal(room.prepEndsAt, null);
});

test('a guessed name disappears for that player for the rest of the current round and resets next round', async () => {
  const manager = new GameManager(() => undefined, { prepMs: 10_000, turnMs: 4, reconnectGraceMs: 50 });
  const { room, player: host } = manager.createRoom('Host', 's1');
  const p2 = room.addPlayer('P2', false, 's2');
  const p3 = room.addPlayer('P3', false, 's3');
  const p4 = room.addPlayer('P4', false, 's4');
  room.setRounds(host.id, 2);
  room.startGame(host.id);
  room.markPrepReady(host.id);
  room.markPrepReady(p2.id);
  room.markPrepReady(p3.id);
  room.markPrepReady(p4.id);

  const describerId = room.turnOrder[room.currentTurnIndex];
  const guesser = room.players.find((p) => p.id !== describerId)!;
  const internals = room as unknown as { availableGuessTargetIds: (playerId: string, describerId: string) => string[] };
  const chosen = internals.availableGuessTargetIds(guesser.id, describerId)[0];
  assert.ok(chosen);
  room.guess(guesser.id, chosen);
  assert.deepEqual(room.buildView(guesser.id).self.usedGuessTargetIds, [chosen]);

  await waitUntil(() => room.phase === 'roundResults');
  room.startNextRound(host.id);
  assert.equal(room.phase, 'prep');
  assert.deepEqual(room.buildView(guesser.id).self.usedGuessTargetIds, []);
  room.destroy();
});

test('new game keeps all participants, resets scores and returns everyone to lobby', async () => {
  const manager = new GameManager(() => undefined, { prepMs: 2, turnMs: 2, reconnectGraceMs: 50 });
  const { room, player: host } = manager.createRoom('Host', 's1');
  room.addPlayer('P2', false, 's2');
  room.addPlayer('P3', false, 's3');
  room.addPlayer('P4', false, 's4');
  const idsBefore = room.players.map((p) => p.id);
  const oldInvite = room.inviteToken;
  room.startGame(host.id);
  await waitUntil(() => room.phase === 'final');
  assert.ok(room.players.some((p) => p.score > 0));

  room.newGame(host.id);
  assert.equal(room.phase, 'lobby');
  assert.deepEqual(room.players.map((p) => p.id), idsBefore);
  assert.ok(room.players.every((p) => p.score === 0));
  assert.equal(room.rounds.length, 0);
  assert.notEqual(room.inviteToken, oldInvite);
});

test('avatar selection is stored and exposed in room state', () => {
  const manager = new GameManager(() => undefined);
  const { room, player } = manager.createRoom('Host', 's1', 'browser-a', 'senior-woman');
  const view = room.buildView(player.id);
  assert.equal(view.self.avatarId, 'senior-woman');
  assert.equal(view.participants[0].avatarId, 'senior-woman');
});


test('disconnect notice is visible immediately and host transfer has a short grace period', () => {
  const manager = new GameManager(() => undefined, { reconnectGraceMs: 30, hostTransferGraceMs: 60_000 });
  const { room, player: host } = manager.createRoom('Host', 's1');
  const guest = room.addPlayer('Guest', false, 's2');

  room.disconnect(guest.id, 's2', () => undefined);
  assert.match(room.buildView(host.id).notice || '', /Guest/);
  assert.equal(room.buildView(host.id).participants.find((p) => p.id === guest.id)?.connected, false);

  room.reconnect(guest.resumeToken, 's2b');
  assert.equal(room.buildView(host.id).notice, null);

  room.disconnect(host.id, 's1', () => undefined);
  assert.match(room.buildView(guest.id).notice || '', /הניהול יעבור/);
  assert.equal(room.buildView(guest.id).participants.find((p) => p.id === host.id)?.connected, false);
});

test('when only one guess option remains the server selects it automatically', () => {
  const manager = new GameManager(() => undefined, { prepMs: 10_000, turnMs: 10_000 });
  const { room, player: host } = manager.createRoom('Host', 's1');
  const p2 = room.addPlayer('P2', false, 's2');
  const p3 = room.addPlayer('P3', false, 's3');
  const p4 = room.addPlayer('P4', false, 's4');
  room.startGame(host.id);
  room.markPrepReady(host.id);
  room.markPrepReady(p2.id);
  room.markPrepReady(p3.id);
  room.markPrepReady(p4.id);
  assert.equal(room.phase, 'turn');

  const describerId = room.turnOrder[room.currentTurnIndex];
  const guesser = room.players.find((p) => p.id !== describerId)!;
  const internals = room as unknown as {
    availableGuessTargetIds: (playerId: string, describerId: string) => string[];
    autoFillForcedGuesses: () => void;
  };
  const available = internals.availableGuessTargetIds(guesser.id, describerId);
  assert.ok(available.length >= 1);
  const keep = available[available.length - 1];
  const fakePair = room.activePairs.find((pair) => pair.describerId !== describerId)!;
  fakePair.guesses.push(...available.slice(0, -1).map((targetId, index) => ({
    playerId: guesser.id,
    targetId,
    at: Date.now() - 1000 + index,
    automatic: false,
  })));

  internals.autoFillForcedGuesses();
  const view = room.buildView(guesser.id);
  assert.equal(view.self.selectedGuessId, keep);
  assert.equal(view.self.selectedGuessAutomatic, true);
  assert.equal(view.self.selectedGuessTargetName, room.players.find((p) => p.id === keep)?.name);
});

test('host transfer is cancelled when the host reconnects before the grace period', async () => {
  const manager = new GameManager(() => undefined, { hostTransferGraceMs: 35, reconnectGraceMs: 10 });
  const { room, player: host } = manager.createRoom('Host', 's1');
  const guest = room.addPlayer('Guest', false, 's2');
  let transferred = false;
  room.disconnect(host.id, 's1', () => {
    transferred = Boolean(room.transferHostFromDisconnected(host.id));
  });
  await new Promise((resolve) => setTimeout(resolve, 10));
  room.reconnect(host.resumeToken, 's1-returned');
  await new Promise((resolve) => setTimeout(resolve, 45));
  assert.equal(transferred, false);
  assert.equal(room.host?.id, host.id);
  assert.equal(room.buildView(guest.id).self.isHost, false);
  room.destroy();
});

test('host role transfers to the second joined connected participant and the room stays alive', async () => {
  const manager = new GameManager(() => undefined, { hostTransferGraceMs: 25, reconnectGraceMs: 10 });
  const { room, player: host } = manager.createRoom('Host', 's1');
  const second = room.addPlayer('Second', false, 's2');
  const third = room.addPlayer('Third', false, 's3');
  room.disconnect(host.id, 's1', () => room.transferHostFromDisconnected(host.id));
  await waitUntil(() => room.host?.id === second.id, 100);
  assert.equal(manager.getRoom(room.code), room);
  assert.equal(room.host?.id, second.id);
  assert.equal(room.buildView(second.id).self.isHost, true);
  assert.equal(room.buildView(third.id).self.isHost, false);
  assert.equal(room.players.some((player) => player.id === host.id), false);
  assert.match(room.buildView(third.id).notice || '', /ניהול/);
  room.destroy();
});

test('a player own assigned target is exposed for disabling but rejected as a guess', () => {
  const manager = new GameManager(() => undefined, { prepMs: 10_000, turnMs: 10_000 });
  const { room, player: host } = manager.createRoom('Host', 's1');
  const p2 = room.addPlayer('P2', false, 's2');
  const p3 = room.addPlayer('P3', false, 's3');
  const p4 = room.addPlayer('P4', false, 's4');
  room.startGame(host.id);
  room.markPrepReady(host.id);
  room.markPrepReady(p2.id);
  room.markPrepReady(p3.id);
  room.markPrepReady(p4.id);
  const describerId = room.turnOrder[room.currentTurnIndex];
  const guesser = room.players.find((player) =>
    player.id !== describerId && room.assignments.get(player.id) !== describerId,
  );
  assert.ok(guesser);
  const protectedTargetId = room.assignments.get(guesser!.id)!;
  const view = room.buildView(guesser!.id);
  assert.equal(view.self.assignedTargetId, protectedTargetId);
  assert.throws(() => room.guess(guesser!.id, protectedTargetId), /אי אפשר לבחור באפשרות הזאת/);
});



test('the current describer is visible in the room state but cannot be selected as a guess target', () => {
  const manager = new GameManager(() => undefined, { prepMs: 10_000, turnMs: 10_000 });
  const { room, player: host } = manager.createRoom('Host', 's1');
  const p2 = room.addPlayer('P2', false, 's2');
  const p3 = room.addPlayer('P3', false, 's3');
  const p4 = room.addPlayer('P4', false, 's4');
  room.startGame(host.id);
  room.markPrepReady(host.id);
  room.markPrepReady(p2.id);
  room.markPrepReady(p3.id);
  room.markPrepReady(p4.id);
  const describerId = room.turnOrder[room.currentTurnIndex];
  const guesser = room.players.find((player) => player.id !== describerId);
  assert.ok(describerId);
  assert.ok(guesser);
  assert.equal(room.buildView(guesser!.id).currentDescriber?.id, describerId);
  assert.throws(() => room.guess(guesser!.id, describerId), /אי אפשר לבחור את מי שמתאר עכשיו כיעד/);
});

test('default turn timer is 10 seconds', () => {
  assert.equal(DEFAULT_TIMINGS.turnMs, 10_000);
});


test('turn advances immediately when every eligible guesser has submitted', () => {
  const manager = new GameManager(() => undefined, { prepMs: 10_000, turnMs: 10_000 });
  const { room, player: host } = manager.createRoom('Host', 's1');
  const p2 = room.addPlayer('P2', false, 's2');
  const p3 = room.addPlayer('P3', false, 's3');
  const p4 = room.addPlayer('P4', false, 's4');
  room.startGame(host.id);
  room.markPrepReady(host.id);
  room.markPrepReady(p2.id);
  room.markPrepReady(p3.id);
  room.markPrepReady(p4.id);
  assert.equal(room.phase, 'turn');

  const initialTurnIndex = room.currentTurnIndex;
  const describerId = room.turnOrder[room.currentTurnIndex];
  const pair = room.activePairs.find((item) => item.describerId === describerId)!;
  const guessers = room.players.filter((player) => player.id !== describerId);

  for (const guesser of guessers) {
    if (room.currentTurnIndex !== initialTurnIndex) break;
    if (pair.guesses.some((guess) => guess.playerId === guesser.id)) continue;
    const internals = room as unknown as { availableGuessTargetIds: (playerId: string, describerId: string) => string[] };
    const available = internals.availableGuessTargetIds(guesser.id, describerId);
    if (available.length) room.guess(guesser.id, available[0]);
  }

  assert.ok(room.currentTurnIndex !== initialTurnIndex || room.phase !== 'turn');
  room.destroy();
});
