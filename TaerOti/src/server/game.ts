import { randomBytes, randomUUID } from 'node:crypto';
import type { FriendshipEdge, PairResult, Phase, PublicPlayer, RoomView, RoundResult } from '../lib/types';
import { normalizeAvatarId } from '../lib/avatars';
import { ROOM_CODE_LENGTH, ROOM_CODE_ALPHABET, normalizeRoomCode } from '../lib/room-code';

export const DEFAULT_TIMINGS = {
  prepMs: 60_000,
  turnMs: 10_000,
  reconnectGraceMs: 20_000,
  hostTransferGraceMs: 10_000,
} as const;

const MIN_PLAYERS = 3;
const INVITE_TOKEN_BYTES = 32;
const RESUME_TOKEN_BYTES = 32;

export type Timings = {
  prepMs: number;
  turnMs: number;
  reconnectGraceMs: number;
  hostTransferGraceMs: number;
};

type TimingsInput = Partial<Timings>;

export type Player = {
  id: string;
  resumeToken: string;
  browserSessionId: string;
  name: string;
  avatarId: string;
  isHost: boolean;
  connected: boolean;
  score: number;
  socketIds: Set<string>;
  disconnectTimer: NodeJS.Timeout | null;
};

type Guess = { playerId: string; targetId: string; at: number; automatic: boolean };
type InternalPair = { describerId: string; targetId: string; guesses: Guess[] };
type Assignment = Map<string, string>;
type StateListener = (room: Room) => void;

function resolveTimings(input: TimingsInput = {}): Timings {
  return { ...DEFAULT_TIMINGS, ...input };
}

function secureToken(bytes: number) {
  return randomBytes(bytes).toString('base64url');
}

export function createRoomCode() {
  const bytes = randomBytes(ROOM_CODE_LENGTH);
  return [...bytes].map((b) => ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length]).join('');
}

function normalizedName(name: string) {
  return name.trim().replace(/\s+/g, ' ').slice(0, 40);
}

function shuffle<T>(input: T[]) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class Room {
  readonly code: string;
  inviteToken: string;
  readonly createdAt = Date.now();
  players: Player[] = [];
  phase: Phase = 'lobby';
  totalRounds = 1;
  currentRound = 0;
  currentTurnIndex = -1;
  prepEndsAt: number | null = null;
  turnEndsAt: number | null = null;
  assignments: Assignment = new Map();
  turnOrder: string[] = [];
  usedPairs = new Set<string>();
  activePairs: InternalPair[] = [];
  rounds: RoundResult[] = [];
  notice: string | null = null;
  prepReady = new Set<string>();
  private noticeForAll = false;
  private timer: NodeJS.Timeout | null = null;
  private onState: StateListener;
  private timings: Timings;

  constructor(code: string, onState: StateListener, timings: TimingsInput = {}) {
    this.code = code;
    this.inviteToken = secureToken(INVITE_TOKEN_BYTES);
    this.onState = onState;
    this.timings = resolveTimings(timings);
  }

  get host() {
    return this.players.find((p) => p.isHost) ?? null;
  }

  get maxRounds() {
    return Math.max(1, this.players.length - 1);
  }

  addPlayer(name: string, isHost: boolean, socketId: string, browserSessionId = '', avatarId: unknown = 'woman') {
    if (this.phase !== 'lobby') throw new Error('המשחק כבר התחיל והחדר נעול להצטרפות.');
    const clean = normalizedName(name);
    if (!clean) throw new Error('צריך להזין שם.');
    const lower = clean.toLocaleLowerCase('he');
    if (this.players.some((p) => p.name.toLocaleLowerCase('he') === lower)) {
      throw new Error('השם כבר קיים בחדר. הוסיפו שם משפחה או כינוי מבדיל.');
    }
    const player: Player = {
      id: randomUUID(),
      resumeToken: secureToken(RESUME_TOKEN_BYTES),
      browserSessionId,
      name: clean,
      avatarId: normalizeAvatarId(avatarId),
      isHost,
      connected: true,
      score: 0,
      socketIds: new Set(socketId ? [socketId] : []),
      disconnectTimer: null,
    };
    this.players.push(player);
    this.totalRounds = Math.min(this.totalRounds, this.maxRounds);
    this.changed();
    return player;
  }


  findPlayerByBrowserSession(browserSessionId: string) {
    if (!browserSessionId) return null;
    return this.players.find((p) => p.browserSessionId === browserSessionId) ?? null;
  }

  reconnectBrowserSession(browserSessionId: string, socketId: string) {
    const player = this.findPlayerByBrowserSession(browserSessionId);
    if (!player) throw new Error('לא נמצאה session פעילה בחדר הזה.');
    return this.reconnect(player.resumeToken, socketId);
  }

  reconnect(resumeToken: string, socketId: string) {
    const player = this.players.find((p) => p.resumeToken === resumeToken);
    if (!player) throw new Error('מפתח החיבור מחדש אינו תקין.');
    const wasDisconnected = !player.connected;
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
    player.connected = true;
    player.socketIds.add(socketId);
    if (wasDisconnected) {
      this.notice = null;
      this.noticeForAll = false;
    }
    this.changed();
    return player;
  }

  disconnect(playerId: string, socketId: string, onExpired: () => void) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player) return;
    player.socketIds.delete(socketId);
    if (player.socketIds.size > 0) return;

    player.connected = false;
    if (player.isHost) {
      const seconds = Math.max(1, Math.ceil(this.timings.hostTransferGraceMs / 1000));
      this.notice = `המארגן התנתק. אם הוא לא יחזור בתוך ${seconds} שניות, הניהול יעבור למשתתף הבא.`;
      this.noticeForAll = true;
    } else if (this.phase === 'lobby') {
      this.notice = `${player.name} התנתק/ה מהלובי.`;
      this.noticeForAll = false;
    } else {
      this.notice = `${player.name} התנתק/ה. ממתינים לחיבור מחדש.`;
      this.noticeForAll = false;
    }

    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    const graceMs = player.isHost ? this.timings.hostTransferGraceMs : this.timings.reconnectGraceMs;
    player.disconnectTimer = setTimeout(() => {
      player.disconnectTimer = null;
      onExpired();
    }, graceMs);
    this.changed();
  }

  transferHostFromDisconnected(playerId: string) {
    const previousHost = this.players.find((p) => p.id === playerId);
    if (!previousHost || previousHost.connected || !previousHost.isHost) return null;

    const successor = this.players.find((p) => p.id !== playerId && p.connected);
    if (!successor) {
      this.notice = 'המארגן התנתק, אבל אין כרגע משתתף מחובר שאפשר להעביר אליו את הניהול.';
      this.noticeForAll = true;
      this.changed();
      return null;
    }

    previousHost.isHost = false;
    successor.isHost = true;
    const previousName = previousHost.name;
    this.removeDisconnectedPlayer(previousHost.id);
    this.notice = `${successor.name} קיבל/ה את ניהול החדר במקום ${previousName}.`;
    this.noticeForAll = true;
    this.changed();
    return successor;
  }

  removeDisconnectedPlayer(playerId: string) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player || player.connected || player.isHost) return;
    this.prepReady.delete(playerId);
    this.players = this.players.filter((p) => p.id !== playerId);
    this.notice = `${player.name} עזב/ה את המשחק.`;
    this.noticeForAll = false;

    if (this.phase === 'lobby') {
      this.totalRounds = Math.min(this.totalRounds, this.maxRounds);
      this.changed();
      return;
    }

    if (this.players.length < MIN_PLAYERS) {
      this.clearAllTimers();
      this.phase = 'final';
      this.notice = 'נותרו פחות משלושה משתתפים, ולכן המשחק הסתיים.';
      this.noticeForAll = true;
      this.changed();
      return;
    }

    if (this.phase === 'prep' || this.phase === 'turn') {
      this.clearAllTimers();
      this.assignments.clear();
      this.activePairs = [];
      this.turnOrder = [];
      this.currentTurnIndex = -1;
      this.notice = `${player.name} עזב/ה. הסבב שובץ מחדש.`;
      this.noticeForAll = true;
      this.startRound(true);
      return;
    }

    this.changed();
  }

  setRounds(playerId: string, rounds: number) {
    this.assertHost(playerId);
    if (this.phase !== 'lobby') throw new Error('אי אפשר לשנות את מספר הסבבים אחרי תחילת המשחק.');
    this.totalRounds = Math.max(1, Math.min(Math.floor(rounds), this.maxRounds));
    this.changed();
  }

  startGame(playerId: string) {
    this.assertHost(playerId);
    if (this.phase !== 'lobby') throw new Error('המשחק כבר התחיל.');
    if (this.players.length < MIN_PLAYERS) throw new Error(`צריך לפחות ${MIN_PLAYERS} משתתפים.`);
    if (this.players.some((player) => !player.connected)) {
      throw new Error('יש משתתף מנותק. המתינו לחיבור מחדש או להסרתו מהלובי.');
    }
    this.totalRounds = Math.min(this.totalRounds, this.maxRounds);
    this.currentRound = 0;
    this.startRound(false);
  }

  startNextRound(playerId: string) {
    this.assertHost(playerId);
    if (this.phase !== 'roundResults') throw new Error('הסבב עדיין לא הסתיים.');
    if (this.currentRound >= this.totalRounds) {
      this.phase = 'final';
      this.changed();
      return;
    }
    this.startRound(false);
  }

  markPrepReady(playerId: string) {
    if (this.phase !== 'prep') throw new Error('שלב ההכנה כבר הסתיים.');
    if (!this.players.some((p) => p.id === playerId)) throw new Error('המשתתף לא נמצא.');
    this.prepReady.add(playerId);
    if (this.prepReady.size >= this.players.length) {
      this.beginTurns();
      return;
    }
    this.changed();
  }

  newGame(playerId: string) {
    this.assertHost(playerId);
    if (this.phase !== 'final') throw new Error('אפשר ליצור משחק חדש רק לאחר סיום המשחק.');
    this.clearAllTimers();
    this.inviteToken = secureToken(INVITE_TOKEN_BYTES);
    this.phase = 'lobby';
    this.totalRounds = 1;
    this.currentRound = 0;
    this.currentTurnIndex = -1;
    this.prepEndsAt = null;
    this.turnEndsAt = null;
    this.assignments.clear();
    this.turnOrder = [];
    this.usedPairs.clear();
    this.activePairs = [];
    this.rounds = [];
    this.prepReady.clear();
    this.notice = null;
    this.noticeForAll = false;
    for (const player of this.players) player.score = 0;
    this.changed();
  }

  guess(playerId: string, targetId: string, automatic = false) {
    if (this.phase !== 'turn') throw new Error('הניחושים סגורים כרגע.');
    const describerId = this.turnOrder[this.currentTurnIndex];
    if (!describerId) throw new Error('אין תור פעיל.');
    if (playerId === describerId) throw new Error('אי אפשר לנחש בתור שלך.');
    if (targetId === describerId) throw new Error('אי אפשר לבחור את מי שמתאר עכשיו כיעד.');
    if (targetId === this.assignments.get(playerId)) throw new Error('אי אפשר לבחור באפשרות הזאת.');
    if (!this.players.some((p) => p.id === targetId)) throw new Error('היעד שנבחר לא קיים בחדר.');
    const pair = this.activePairs.find((p) => p.describerId === describerId);
    if (!pair) throw new Error('התור לא נמצא.');
    if (pair.guesses.some((g) => g.playerId === playerId)) throw new Error('כבר שלחת ניחוש בתור הזה.');
    const alreadyUsedThisRound = this.activePairs.some((activePair) =>
      activePair !== pair && activePair.guesses.some((guess) => guess.playerId === playerId && guess.targetId === targetId),
    );
    if (alreadyUsedThisRound) throw new Error('כבר בחרת בשם הזה בסבב הנוכחי.');
    pair.guesses.push({ playerId, targetId, at: Date.now(), automatic });
    if (this.allGuessersDoneForCurrentTurn(pair, describerId)) {
      this.closeTurn();
      return;
    }
    this.changed();
  }

  buildView(playerId: string): RoomView {
    const self = this.players.find((p) => p.id === playerId);
    if (!self) throw new Error('המשתתף לא נמצא.');
    const currentDescriberId = this.turnOrder[this.currentTurnIndex] ?? null;
    const currentPair = currentDescriberId
      ? this.activePairs.find((p) => p.describerId === currentDescriberId) ?? null
      : null;
    const selectedGuess = currentPair?.guesses.find((g) => g.playerId === self.id) ?? null;
    const selectedGuessTarget = selectedGuess ? this.players.find((p) => p.id === selectedGuess.targetId) ?? null : null;
    const usedGuessTargetIds = this.phase === 'turn'
      ? [...new Set(this.activePairs.flatMap((pair) =>
        pair.guesses.filter((guess) => guess.playerId === self.id).map((guess) => guess.targetId),
      ))]
      : [];
    const targetId = this.assignments.get(self.id) ?? null;
    const target = targetId ? this.players.find((p) => p.id === targetId) ?? null : null;

    return {
      code: this.code,
      inviteToken: self.isHost ? this.inviteToken : null,
      phase: this.phase,
      totalRounds: this.totalRounds,
      roundNumber: Math.max(1, this.currentRound),
      participants: this.players.map((p) => this.publicPlayer(p)),
      self: {
        id: self.id,
        name: self.name,
        avatarId: self.avatarId,
        isHost: self.isHost,
        targetName: this.phase === 'prep' ? target?.name ?? null : null,
        assignedTargetId: this.phase === 'prep' || this.phase === 'turn' ? targetId : null,
        selectedGuessId: selectedGuess?.targetId ?? null,
        selectedGuessAutomatic: selectedGuess?.automatic ?? false,
        selectedGuessTargetName: selectedGuessTarget?.name ?? null,
        usedGuessTargetIds,
        prepReady: this.prepReady.has(self.id),
      },
      prepReadyCount: this.phase === 'prep' ? this.prepReady.size : 0,
      prepReadyTotal: this.phase === 'prep' ? this.players.length : 0,
      timerEndsAt: this.phase === 'prep' ? this.prepEndsAt : this.phase === 'turn' ? this.turnEndsAt : null,
      currentDescriber: currentDescriberId
        ? this.publicPlayer(this.players.find((p) => p.id === currentDescriberId)!)
        : null,
      turnOrder: this.turnOrder.map((id, index) => ({
        id,
        name: this.players.find((p) => p.id === id)?.name ?? 'משתתף',
        current: index === this.currentTurnIndex,
      })),
      roundResult: this.phase === 'roundResults' ? this.rounds.at(-1) ?? null : null,
      allRounds: this.phase === 'final' ? this.rounds : [],
      friendshipEdges: this.phase === 'final' ? this.friendshipEdges() : [],
      notice: this.notice && (self.isHost || this.noticeForAll) ? this.notice : null,
      canStart: this.phase === 'lobby' && this.players.length >= MIN_PLAYERS && this.players.every((player) => player.connected),
      minPlayers: MIN_PLAYERS,
      maxRounds: this.maxRounds,
    };
  }

  clearNotice(playerId: string) {
    this.assertHost(playerId);
    this.notice = null;
    this.noticeForAll = false;
    this.changed();
  }

  socketIds() {
    return this.players.flatMap((player) => [...player.socketIds].map((socketId) => ({ playerId: player.id, socketId })));
  }

  destroy() {
    this.clearAllTimers();
    for (const player of this.players) {
      if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
      player.disconnectTimer = null;
      player.socketIds.clear();
    }
  }

  private startRound(restarted: boolean) {
    if (!restarted) this.currentRound += 1;
    this.phase = 'prep';
    this.currentTurnIndex = -1;
    this.assignments = this.createAssignments();
    this.turnOrder = shuffle(this.players.map((p) => p.id));
    this.prepReady = new Set();
    this.activePairs = this.turnOrder.map((describerId) => ({
      describerId,
      targetId: this.assignments.get(describerId)!,
      guesses: [],
    }));
    this.prepEndsAt = Date.now() + this.timings.prepMs;
    this.turnEndsAt = null;
    if (!restarted) {
      this.notice = null;
      this.noticeForAll = false;
    }
    this.clearAllTimers();
    this.timer = setTimeout(() => this.beginTurns(), this.timings.prepMs);
    if (this.prepReady.size >= this.players.length) this.beginTurns();
    else this.changed();
  }

  private beginTurns() {
    if (this.phase !== 'prep') return;
    this.phase = 'turn';
    this.prepReady.clear();
    this.prepEndsAt = null;
    this.currentTurnIndex = 0;
    this.startTurnTimer();
    this.changed();
  }

  private startTurnTimer() {
    this.clearTimer();
    this.turnEndsAt = Date.now() + this.timings.turnMs;
    this.autoFillForcedGuesses();
    const describerId = this.turnOrder[this.currentTurnIndex];
    const pair = this.activePairs.find((item) => item.describerId === describerId);
    if (describerId && pair && this.allGuessersDoneForCurrentTurn(pair, describerId)) {
      this.closeTurn();
      return;
    }
    this.timer = setTimeout(() => this.closeTurn(), this.timings.turnMs);
  }

  private availableGuessTargetIds(playerId: string, describerId: string) {
    const used = new Set(this.activePairs.flatMap((pair) =>
      pair.guesses.filter((guess) => guess.playerId === playerId).map((guess) => guess.targetId),
    ));
    const assignedTargetId = this.assignments.get(playerId) ?? null;
    return this.players
      .map((p) => p.id)
      .filter((targetId) => targetId !== describerId && targetId !== assignedTargetId && !used.has(targetId));
  }

  private autoFillForcedGuesses() {
    const describerId = this.turnOrder[this.currentTurnIndex];
    const pair = this.activePairs.find((item) => item.describerId === describerId);
    if (!describerId || !pair) return;
    for (const player of this.players) {
      if (player.id === describerId || !player.connected) continue;
      if (pair.guesses.some((guess) => guess.playerId === player.id)) continue;
      const available = this.availableGuessTargetIds(player.id, describerId);
      if (available.length === 1) {
        pair.guesses.push({ playerId: player.id, targetId: available[0], at: Date.now(), automatic: true });
      }
    }
  }


  private allGuessersDoneForCurrentTurn(pair: InternalPair, describerId: string) {
    return this.players
      .filter((player) => player.id !== describerId && player.connected)
      .every((player) => pair.guesses.some((guess) => guess.playerId === player.id)
        || this.availableGuessTargetIds(player.id, describerId).length === 0);
  }

  private closeTurn() {
    if (this.phase !== 'turn') return;
    const describerId = this.turnOrder[this.currentTurnIndex];
    const pair = this.activePairs.find((p) => p.describerId === describerId);
    if (pair) this.scorePair(pair);

    if (this.currentTurnIndex + 1 < this.turnOrder.length) {
      this.currentTurnIndex += 1;
      this.startTurnTimer();
      this.changed();
      return;
    }
    this.finishRound();
  }

  private scorePair(pair: InternalPair) {
    const correct = pair.guesses.filter((g) => g.targetId === pair.targetId).sort((a, b) => a.at - b.at)[0] ?? null;
    const describer = this.players.find((p) => p.id === pair.describerId);
    if (!describer) return;
    if (correct) {
      describer.score += 1;
      const guesser = this.players.find((p) => p.id === correct.playerId);
      if (guesser) guesser.score += 2;
    } else {
      describer.score += 3;
    }
  }

  private finishRound() {
    this.clearAllTimers();
    this.turnEndsAt = null;
    const pairs: PairResult[] = this.activePairs.map((pair) => {
      const describer = this.players.find((p) => p.id === pair.describerId)!;
      const target = this.players.find((p) => p.id === pair.targetId)!;
      const correct = pair.guesses.filter((g) => g.targetId === pair.targetId).sort((a, b) => a.at - b.at)[0] ?? null;
      const guesser = correct ? this.players.find((p) => p.id === correct.playerId) ?? null : null;
      return {
        describerId: describer.id,
        describerName: describer.name,
        targetId: target.id,
        targetName: target.name,
        firstCorrectGuesserId: guesser?.id ?? null,
        firstCorrectGuesserName: guesser?.name ?? null,
        guessed: Boolean(guesser),
        describerPoints: guesser ? 1 : 3,
        guesserPoints: guesser ? 2 : 0,
      };
    });
    this.rounds.push({ roundNumber: this.currentRound, pairs });
    for (const pair of this.activePairs) this.usedPairs.add(`${pair.describerId}:${pair.targetId}`);
    this.phase = this.currentRound >= this.totalRounds ? 'final' : 'roundResults';
    this.assignments.clear();
    this.changed();
  }

  private createAssignments(): Assignment {
    const ids = this.players.map((p) => p.id);
    const maxAttempts = 120;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const describers = shuffle(ids);
      const assigned = new Map<string, string>();
      const usedTargets = new Set<string>();
      const search = (index: number): boolean => {
        if (index >= describers.length) return true;
        const describerId = describers[index];
        const candidates = shuffle(ids.filter((targetId) =>
          targetId !== describerId && !usedTargets.has(targetId) && !this.usedPairs.has(`${describerId}:${targetId}`),
        ));
        for (const targetId of candidates) {
          assigned.set(describerId, targetId);
          usedTargets.add(targetId);
          if (search(index + 1)) return true;
          assigned.delete(describerId);
          usedTargets.delete(targetId);
        }
        return false;
      };
      if (search(0)) return assigned;
    }
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const targets = shuffle(ids);
      if (targets.every((targetId, index) => targetId !== ids[index])) {
        return new Map(ids.map((id, index) => [id, targets[index]]));
      }
    }
    throw new Error('לא ניתן ליצור שיבוץ חוקי לסבב.');
  }

  private friendshipEdges(): FriendshipEdge[] {
    const weights = new Map<string, number>();
    const add = (a: string, b: string, amount: number) => {
      const key = [a, b].sort().join(':');
      weights.set(key, (weights.get(key) ?? 0) + amount);
    };
    for (const round of this.rounds) {
      for (const pair of round.pairs) {
        add(pair.describerId, pair.targetId, 1);
        if (pair.firstCorrectGuesserId) add(pair.firstCorrectGuesserId, pair.targetId, 2);
      }
    }
    return [...weights.entries()].map(([key, weight]) => {
      const [a, b] = key.split(':');
      return { a, b, weight };
    });
  }

  private assertHost(playerId: string) {
    const player = this.players.find((p) => p.id === playerId);
    if (!player?.isHost) throw new Error('הפעולה זמינה למארגן בלבד.');
  }

  private publicPlayer(player: Player): PublicPlayer {
    return {
      id: player.id,
      name: player.name,
      avatarId: player.avatarId,
      connected: player.connected,
      isHost: player.isHost,
      score: player.score,
    };
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }


  private clearAllTimers() {
    this.clearTimer();
  }

  private changed() {
    this.onState(this);
  }
}

export class GameManager {
  rooms = new Map<string, Room>();
  private onState: StateListener;
  private timings: Timings;

  constructor(onState: StateListener, timings: TimingsInput = {}) {
    this.onState = onState;
    this.timings = resolveTimings(timings);
  }

  createRoom(name: string, socketId: string, browserSessionId = '', avatarId: unknown = 'woman') {
    let code = createRoomCode();
    while (this.rooms.has(code)) code = createRoomCode();
    const room = new Room(code, this.onState, this.timings);
    this.rooms.set(code, room);
    const player = room.addPlayer(name, true, socketId, browserSessionId, avatarId);
    return { room, player };
  }

  getRoom(code: unknown) {
    if (typeof code !== 'string') return null;
    const normalized = normalizeRoomCode(code);
    if (!normalized) return null;
    return this.rooms.get(normalized) ?? null;
  }

  getRoomByInvite(inviteToken: unknown) {
    if (typeof inviteToken !== 'string' || inviteToken.length < 32) return null;
    for (const room of this.rooms.values()) {
      if (room.inviteToken === inviteToken) return room;
    }
    return null;
  }

  deleteRoom(code: unknown) {
    const room = this.getRoom(code);
    if (!room) return false;
    room.destroy();
    this.rooms.delete(room.code);
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      if (now - room.createdAt > 6 * 60 * 60 * 1000 && room.players.every((p) => !p.connected)) {
        room.destroy();
        this.rooms.delete(code);
      }
    }
  }
}
