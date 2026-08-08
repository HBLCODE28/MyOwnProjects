'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import QRCode from 'qrcode';
import type { PublicPlayer, RoomView, RoundResult } from '@/lib/types';
import { AVATARS, avatarImageUrl, isFemaleAvatar } from '@/lib/avatars';
import { buildInviteUrl, buildSessionUrl, readResumeToken } from '@/lib/links';
import { ROOM_CODE_LENGTH, normalizeRoomCode } from '@/lib/room-code';

type Ack = { ok: boolean; error?: string; roomCode?: string; resumeToken?: string; added?: number };

let turnAudioContext: AudioContext | null = null;

function getTurnAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  turnAudioContext ??= new AudioContextCtor();
  return turnAudioContext;
}

async function unlockTurnAudio() {
  const context = getTurnAudioContext();
  if (!context) return;
  if (context.state === 'suspended') {
    try { await context.resume(); } catch { /* browser may reject until a later gesture */ }
  }
}

function playHostTurnJingle() {
  const context = getTurnAudioContext();
  if (!context || context.state !== 'running') return;
  const start = context.currentTime + 0.015;
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const noteStart = start + index * 0.105;
    const noteEnd = noteStart + 0.16;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteEnd + 0.02);
  });
}

function initials(name: string) {
  return name.trim().charAt(0) || '?';
}

function avatarClass(index: number) {
  return `avatar avatar-${index % 6}`;
}

function MaterialAvatar({ avatarId, index = 0, selected = false }: { avatarId: string; index?: number; selected?: boolean }) {
  return (
    <span className={`${avatarClass(index)} character-avatar${selected ? ' avatar-selected' : ''}`} aria-hidden="true">
      <img className="avatar-image" src={avatarImageUrl(avatarId)} alt="" loading="lazy" draggable={false} />
    </span>
  );
}

function AvatarPicker({ value, onChange, label = 'בחרו דמות' }: { value: string; onChange: (value: string) => void; label?: string }) {
  return (
    <div className="avatar-picker-wrap">
      <div className="label">{label}</div>
      <div className="avatar-picker" role="radiogroup" aria-label={label}>
        {AVATARS.map((avatar, index) => (
          <button
            type="button"
            className={`avatar-choice${value === avatar.id ? ' selected' : ''}`}
            key={avatar.id}
            role="radio"
            aria-checked={value === avatar.id}
            aria-label={avatar.label}
            onClick={() => onChange(avatar.id)}
          >
            <MaterialAvatar avatarId={avatar.id} index={index} selected={value === avatar.id} />
            <span>{avatar.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function useCountdown(endsAt: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [endsAt]);
  return endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;
}

function emitAck(socket: Socket, event: string, payload: unknown): Promise<Ack> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response: Ack) => resolve(response));
  });
}

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

function isInstalledDisplayMode() {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: fullscreen)').matches
    || window.matchMedia('(display-mode: standalone)').matches
    || nav.standalone === true;
}

function isMobileGameViewport() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 679px)').matches || window.matchMedia('(pointer: coarse)').matches;
}

async function requestGameFullscreen() {
  if (typeof document === 'undefined' || isInstalledDisplayMode() || !isMobileGameViewport()) return true;
  const element = document.documentElement as WebkitElement;
  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen({ navigationUI: 'hide' });
      return true;
    }
    if (element.webkitRequestFullscreen) {
      await element.webkitRequestFullscreen();
      return true;
    }
  } catch {
    // Browsers may still reject fullscreen; the next main user action will try again.
  }
  return false;
}

function useAutomaticFullscreen() {
  useEffect(() => {
    if (isInstalledDisplayMode() || !isMobileGameViewport()) return;
    let done = false;
    const attempt = () => {
      if (done) return;
      done = true;
      void requestGameFullscreen();
      void unlockTurnAudio();
      document.removeEventListener('click', attempt, true);
    };
    // Browsers require a user gesture. Using the first normal click makes
    // fullscreen automatic from the user's point of view without a separate button.
    document.addEventListener('click', attempt, true);
    return () => document.removeEventListener('click', attempt, true);
  }, []);
}

function Brand({ roomCode }: { roomCode?: string }) {
  return (
    <div className="brand">
      <div className="brand-logo" aria-label="תאר אותי">
        <span className="brand-logo-box">תאר</span>
        <span className="brand-logo-plain">אותי</span>
      </div>
      {roomCode ? <div className="room-pill">{roomCode}</div> : null}
    </div>
  );
}

function ParticipantList({ players }: { players: PublicPlayer[] }) {
  return (
    <ul className="participant-list">
      {players.map((player, index) => (
        <li className="participant" key={player.id}>
          <MaterialAvatar avatarId={player.avatarId} index={index} />
          <span className="participant-name">{player.name}</span>
          {player.isHost ? <span className="badge badge-host">מארגן</span> : null}
          {!player.connected ? <span className="badge badge-offline">מנותק</span> : null}
        </li>
      ))}
    </ul>
  );
}

function Timer({ endsAt, totalSeconds, big = false }: { endsAt: number | null; totalSeconds: number; big?: boolean }) {
  const seconds = useCountdown(endsAt);
  const ratio = Math.max(0, Math.min(1, seconds / totalSeconds));
  const progress = `${Math.round(ratio * 360)}deg`;
  return (
    <div className={`timer${big ? ' big' : ''}`} style={{ '--progress': progress } as React.CSSProperties}>
      <div className="center" style={{ position: 'relative', zIndex: 1 }}>
        <div className="timer-number">{seconds}</div>
        <div className="timer-label">שניות</div>
      </div>
    </div>
  );
}

function Home({ socket, initialCode, initialInvite, onIdentity, busy, setBusy, error, setError }: {
  socket: Socket;
  initialCode: string;
  initialInvite: string;
  onIdentity: (roomCode: string, resumeToken: string) => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
  error: string;
  setError: (v: string) => void;
}) {
  const [name, setName] = useState('');
  const [avatarId, setAvatarId] = useState(AVATARS[0].id);
  const [joinCode, setJoinCode] = useState(initialCode);

  const create = async () => {
    void requestGameFullscreen();
    setBusy(true); setError('');
    const res = await emitAck(socket, 'room:create', { name, avatarId });
    setBusy(false);
    if (!res.ok || !res.roomCode || !res.resumeToken) return setError(res.error || 'לא ניתן ליצור חדר.');
    onIdentity(res.roomCode, res.resumeToken);
    void emitAck(socket, 'room:sync', {});
  };

  const join = async () => {
    void requestGameFullscreen();
    setBusy(true); setError('');
    const res = await emitAck(socket, 'room:join', {
      code: initialInvite ? undefined : joinCode,
      invite: initialInvite || undefined,
      name,
      avatarId,
    });
    setBusy(false);
    if (!res.ok || !res.roomCode || !res.resumeToken) return setError(res.error || 'לא ניתן להצטרף לחדר.');
    onIdentity(res.roomCode, res.resumeToken);
    void emitAck(socket, 'room:sync', {});
  };

  const canContinue = Boolean(name.trim()) && !busy;

  return (
    <div className="content screen-home">
      <Brand />
      <h1 className="title">מי מכיר אותך במילה אחת?</h1>

      <div className="home-layout">
        <div className="card home-profile-card">
          <div style={{ fontWeight: 800, fontSize: 15 }}>הפרטים שלך</div>
          <div className="field">
            <label className="label" htmlFor="player-name">השם שלך</label>
            <input id="player-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: דנה" autoComplete="name" />
          </div>
          <AvatarPicker value={avatarId} onChange={setAvatarId} label="בחרו דמות" />
        </div>

        <div className="home-actions-panel">
          {!initialCode && !initialInvite ? (
            <>
              <div className="card home-create-card">
                <div style={{ fontWeight: 800, fontSize: 15 }}>יצירת משחק</div>
                <div className="small" style={{ marginTop: 6 }}>פתחו חדר חדש והזמינו את שאר המשתתפים.</div>
                <div className="actions">
                  <button className="btn btn-primary" onClick={create} disabled={!canContinue}>צור חדר חדש</button>
                </div>
              </div>
              <div className="divider">או</div>
            </>
          ) : null}

          <div className="card home-join-card">
            <div style={{ fontWeight: 800, fontSize: 15 }}>{initialCode ? `הצטרפות לחדר ${initialCode}` : 'הצטרפות לחדר'}</div>
            {!initialInvite ? (
              <div className="field join-code-field">
                <label className="label" htmlFor="join-code">קוד חדר (8 תווים)</label>
                <input
                  id="join-code"
                  className="input join-code-input"
                  style={{ direction: 'ltr', textAlign: 'center', letterSpacing: 3, fontWeight: 800 }}
                  value={joinCode}
                  onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value).slice(0, ROOM_CODE_LENGTH))}
                  onFocus={(event) => { const input = event.currentTarget; window.setTimeout(() => input.scrollIntoView({ behavior: 'smooth', block: 'center' }), 250); }}
                  placeholder="7Q3K9M2R"
                  maxLength={12}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  enterKeyHint="done"
                />
              </div>
            ) : null}
            <div className="actions">
              <button className="btn btn-secondary" onClick={join} disabled={!canContinue || (!initialInvite && joinCode.length !== ROOM_CODE_LENGTH)}>הצטרף לחדר</button>
            </div>
          </div>
        </div>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="spacer" />
    </div>
  );
}

function InfoPopup({ message, onClose }: { message: string; onClose: () => void }) {
  if (!message) return null;
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="info-popup-title" onClick={(event) => event.stopPropagation()}>
        <div id="info-popup-title" className="modal-title">מספר סבבים</div>
        <div className="modal-text">{message}</div>
        <button className="btn btn-primary" type="button" onClick={onClose}>הבנתי</button>
      </div>
    </div>
  );
}

function Lobby({ room, socket, origin, setError }: { room: RoomView; socket: Socket; origin: string; setError: (v: string) => void }) {
  const shareUrl = room.inviteToken ? buildInviteUrl(origin, room.inviteToken) : '';
  const [shareStatus, setShareStatus] = useState('');
  const [roundsPopup, setRoundsPopup] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!room.self.isHost || !shareUrl) {
      setQrDataUrl('');
      return;
    }
    void QRCode.toDataURL(shareUrl, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(''); });
    return () => { cancelled = true; };
  }, [room.self.isHost, shareUrl]);

  const setRounds = async (rounds: number) => {
    if (rounds < 1) {
      setRoundsPopup('אי אפשר לבחור פחות מסבב אחד.');
      return;
    }
    if (rounds > room.maxRounds) {
      const count = room.participants.length;
      setRoundsPopup(`כרגע יש ${count} ${count === 1 ? 'משתתף' : 'משתתפים'}, ולכן אפשר לבחור עד ${room.maxRounds} סבבים. כשיצטרפו משתתפים נוספים יהיה אפשר להגדיל.`);
      return;
    }
    const res = await emitAck(socket, 'room:set-rounds', { rounds });
    if (!res.ok) setError(res.error || 'לא ניתן לעדכן את מספר הסבבים.');
  };

  const start = async () => {
    void requestGameFullscreen();
    void unlockTurnAudio();
    const res = await emitAck(socket, 'game:start', {});
    if (!res.ok) setError(res.error || 'לא ניתן להתחיל את המשחק.');
  };

  const share = async () => {
    const text = '🎉 בואו כנסו למשחק "תאר אותי"! 🎯\n👇 לחצו על הקישור והצטרפו:';
    const fullMessage = `${text}\n${shareUrl}`;
    const copyFallback = async () => {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullMessage);
        return;
      }
      const area = document.createElement('textarea');
      area.value = fullMessage;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      if (!copied) throw new Error('copy failed');
    };

    try {
      if (navigator.share) {
        await navigator.share({ title: 'תאר אותי', text, url: shareUrl });
        setShareStatus('חלון השיתוף נפתח');
      } else {
        await copyFallback();
        setShareStatus('ההזמנה הועתקה');
      }
      window.setTimeout(() => setShareStatus(''), 1800);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      try {
        await copyFallback();
        setShareStatus('ההזמנה הועתקה');
        window.setTimeout(() => setShareStatus(''), 1800);
      } catch {
        setError('לא ניתן לפתוח את השיתוף או להעתיק את ההזמנה.');
      }
    }
  };


  return (
    <div className="content screen-lobby">
      <Brand roomCode={room.code} />
      <div className="eyebrow section-heading">לובי</div>
      <div className="lobby-layout">
        <div className="lobby-controls-panel">
          <div className="room-code">
            <div className="room-code-label">קוד החדר</div>
            <div className="room-code-value">{room.code}</div>
            {room.self.isHost && qrDataUrl ? (
              <div className="qr-section">
                <div className="qr-wrap"><img src={qrDataUrl} alt="QR להצטרפות למשחק" /></div>
                <div className="qr-caption">סרקו כדי להצטרף</div>
              </div>
            ) : null}
          </div>

          {room.self.isHost && shareUrl ? (
            <div className="actions share-actions">
              <button className="btn btn-secondary" type="button" onClick={share}>שתף משחק</button>
              {shareStatus ? <div className="small center">{shareStatus}</div> : null}
            </div>
          ) : null}

          {room.self.isHost ? (
            <>
              <div className="stepper" style={{ marginTop: 12 }}>
                <div><div style={{ fontSize: 13, fontWeight: 750 }}>מספר סבבים</div></div>
                <div className="stepper-controls">
                  <button className="stepper-btn" type="button" aria-label="הפחת מספר סבבים" onClick={() => setRounds(room.totalRounds - 1)}>-</button>
                  <span className="stepper-value">{room.totalRounds}</span>
                  <button className="stepper-btn" type="button" aria-label="הגדל מספר סבבים" onClick={() => setRounds(room.totalRounds + 1)}>+</button>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="card lobby-list-card">
          <div style={{ color: 'var(--text-2)', fontSize: 12, marginBottom: 7 }}>משתתפים ({room.participants.length})</div>
          <ParticipantList players={room.participants} />
        </div>
      </div>
      <div className="actions">
        {room.self.isHost ? (
          <>
            <button className="btn btn-primary" onClick={start} disabled={!room.canStart}>התחל משחק</button>
            {room.participants.length < room.minPlayers ? (
              <div className="small center">צריך לפחות {room.minPlayers} משתתפים כדי להתחיל.</div>
            ) : null}
          </>
        ) : <button className="btn btn-outline" disabled>ממתינים למארגן</button>}
      </div>
      <InfoPopup message={roundsPopup} onClose={() => setRoundsPopup('')} />
    </div>
  );
}

function Prep({ room, socket, setError }: { room: RoomView; socket: Socket; setError: (v: string) => void }) {
  const ready = async () => {
    if (room.self.prepReady) return;
    const res = await emitAck(socket, 'game:prep-ready', {});
    if (!res.ok) setError(res.error || 'לא ניתן לסמן מוכנות.');
  };

  return (
    <div className="content screen-prep">
      <Brand roomCode={room.code} />
      <div className="eyebrow">סבב {room.roundNumber} מתוך {room.totalRounds} - שלב הכנה</div>
      <div className="center" style={{ marginTop: 48 }}>
        <div className="small">עליך לתאר במילה אחת את</div>
        <div className="target-name">{room.self.targetName}</div>
        <Timer endsAt={room.timerEndsAt} totalSeconds={60} />
      </div>
      <div className="spacer" />
      <div className="card center">
        <div style={{ fontWeight: 800, fontSize: 13 }}>מוכנים: {room.prepReadyCount} מתוך {room.prepReadyTotal}</div>
        <div className="actions" style={{ marginTop: 12 }}>
          <button className="btn btn-primary" onClick={ready} disabled={room.self.prepReady}>
            {room.self.prepReady ? (isFemaleAvatar(room.self.avatarId) ? 'מוכנה' : 'מוכן') : 'התחל משחק'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Turn({ room, socket, setError }: { room: RoomView; socket: Socket; setError: (v: string) => void }) {
  const current = room.currentDescriber;
  const isDescriber = current?.id === room.self.id;
  const selected = room.self.selectedGuessId;
  const usedGuessTargetIds = new Set(room.self.usedGuessTargetIds);
  const assignedTargetId = room.self.assignedTargetId;

  const guess = async (targetId: string) => {
    if (selected || isDescriber) return;
    const res = await emitAck(socket, 'game:guess', { targetId });
    if (!res.ok) setError(res.error || 'הניחוש לא נשלח.');
  };

  return (
    <div className="content screen-turn">
      <Brand roomCode={room.code} />
      <div className="eyebrow">סבב {room.roundNumber} מתוך {room.totalRounds}</div>
      {isDescriber ? (
        <>
          <div className="center" style={{ marginTop: 16 }}>
            <div className="small">עכשיו התור שלך</div>
            <h1 className="title" style={{ marginTop: 4 }}>{isFemaleAvatar(room.self.avatarId) ? 'אמרי את המילה בקול' : 'אמור את המילה בקול'}</h1>
          </div>
          <Timer endsAt={room.timerEndsAt} totalSeconds={10} big />
          <div className="card center">
            <div style={{ fontSize: 13, fontWeight: 800 }}>כל השאר מנחשים עכשיו</div>
          </div>
        </>
      ) : (
        <>
          <div className="center">
            <div className="small">{current ? `${current.name} ${isFemaleAvatar(current.avatarId) ? 'מתארת' : 'מתאר'} עכשיו במילה אחת` : ''}</div>
            <h1 className="title" style={{ fontSize: 24, marginTop: 5 }}>מי היעד?</h1>
          </div>
          <Timer endsAt={room.timerEndsAt} totalSeconds={10} />
          <div className="guess-grid">
            {room.participants.filter((player) =>
              player.id === current?.id || player.id === assignedTargetId || !usedGuessTargetIds.has(player.id) || selected === player.id,
            ).map((player, index) => {
              const isAssignedTarget = player.id === assignedTargetId;
              const isCurrentDescriber = player.id === current?.id;
              const isBlockedTarget = isAssignedTarget || isCurrentDescriber;
              return (
                <button
                  className={`guess${selected === player.id ? ' selected' : ''}${isBlockedTarget ? ' protected' : ''}`}
                  key={player.id}
                  onClick={() => guess(player.id)}
                  disabled={Boolean(selected) || isBlockedTarget}
                  aria-disabled={Boolean(selected) || isBlockedTarget}
                >
                  <MaterialAvatar avatarId={player.avatarId} index={index} />
                  <span className="guess-name">{player.name}</span>
                </button>
              );
            })}
          </div>
          {selected && room.self.selectedGuessAutomatic ? (
            <div className="auto-guess-note">נשארה רק אפשרות אחת, לכן {room.self.selectedGuessTargetName} {isFemaleAvatar(room.participants.find((player) => player.id === selected)?.avatarId || 'man') ? 'נבחרה' : 'נבחר'} אוטומטית.</div>
          ) : selected ? (
            <div className="small center" style={{ marginTop: 12 }}>הניחוש נשלח.</div>
          ) : null}
        </>
      )}
      <div className="spacer" />
      <div className="turn-chips">
        {room.turnOrder.map((p) => <span className={`turn-chip${p.current ? ' current' : ''}`} key={p.id}>{p.name}</span>)}
      </div>
    </div>
  );
}

function ScoreTable({ players, roundResult }: { players: PublicPlayer[]; roundResult?: RoundResult | null }) {
  const roundPoints = new Map<string, number>();
  if (roundResult) {
    for (const pair of roundResult.pairs) {
      roundPoints.set(pair.describerId, (roundPoints.get(pair.describerId) ?? 0) + pair.describerPoints);
      if (pair.firstCorrectGuesserId) {
        roundPoints.set(pair.firstCorrectGuesserId, (roundPoints.get(pair.firstCorrectGuesserId) ?? 0) + pair.guesserPoints);
      }
    }
  }
  const sorted = [...players].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'he'));
  return (
    <table className="score-table">
      <thead><tr><th></th><th>שם</th>{roundResult ? <th>סבב זה</th> : null}<th>סה"כ</th></tr></thead>
      <tbody>
        {sorted.map((player, index) => (
          <tr key={player.id}>
            <td><span className={`rank${index === 0 ? ' first' : ''}`}>{index + 1}</span></td>
            <td>{player.name}</td>
            {roundResult ? <td>+{roundPoints.get(player.id) ?? 0}</td> : null}
            <td><strong>{player.score}</strong></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RoundPairs({ result }: { result: RoundResult }) {
  return (
    <>
      {result.pairs.map((pair) => (
        <div className="result-row" key={`${pair.describerId}:${pair.targetId}`}>
          <div className="result-main">
            <div className="result-pair"><strong>{pair.describerName}</strong><span className="result-arrow">→</span>{pair.targetName}</div>
            <span className={`badge ${pair.guessed ? 'badge-success' : 'badge-warn'}`}>{pair.guessed ? 'נוחש' : 'לא נוחש'}</span>
          </div>
          <div className="result-detail">{pair.guessed ? `ניחוש ראשון נכון: ${pair.firstCorrectGuesserName} (+2), ${pair.describerName}: +1` : `אף אחד לא ניחש - ${pair.describerName}: +3`}</div>
        </div>
      ))}
    </>
  );
}

function RoundResults({ room, socket, setError }: { room: RoomView; socket: Socket; setError: (v: string) => void }) {
  const next = async () => {
    const res = await emitAck(socket, 'game:next-round', {});
    if (!res.ok) setError(res.error || 'לא ניתן להתחיל את הסבב הבא.');
  };
  return (
    <div className="content screen-results">
      <Brand roomCode={room.code} />
      <div className="eyebrow">תוצאות סבב {room.roundNumber}</div>
      <div className="results-layout">
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 9 }}>מי תיאר את מי</div>
          {room.roundResult ? <RoundPairs result={room.roundResult} /> : null}
        </div>
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 7 }}>טבלת ניקוד מצטברת</div>
          <ScoreTable players={room.participants} roundResult={room.roundResult} />
        </div>
      </div>
      <div className="spacer" />
      <div className="actions">
        {room.self.isHost ? <button className="btn btn-primary" onClick={next}>התחל סבב {room.roundNumber + 1}</button> : <button className="btn btn-outline" disabled>ממתינים למארגן לסבב הבא</button>}
      </div>
    </div>
  );
}

function FriendshipGraph({ room }: { room: RoomView }) {
  const size = 320;
  const center = size / 2;
  const radius = 112;
  const positions = new Map(room.participants.map((player, index) => {
    const angle = (index / Math.max(1, room.participants.length)) * Math.PI * 2 - Math.PI / 2;
    return [player.id, { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius }];
  }));
  const maxWeight = Math.max(1, ...room.friendshipEdges.map((e) => e.weight));

  return (
    <div className="card graph-card">
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" aria-label="מפת חברויות">
        {room.friendshipEdges.map((edge) => {
          const a = positions.get(edge.a); const b = positions.get(edge.b);
          if (!a || !b) return null;
          const width = 1.2 + (edge.weight / maxWeight) * 5;
          const opacity = .22 + (edge.weight / maxWeight) * .65;
          return <line key={`${edge.a}:${edge.b}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#8B5CF6" strokeWidth={width} opacity={opacity} strokeLinecap="round" />;
        })}
        {room.participants.map((player, index) => {
          const p = positions.get(player.id)!;
          const fills = ['#8B5CF6','#6366F1','#2DD4BF','#34D399','#FBBF24','#FB7175'];
          return (
            <g key={player.id}>
              <circle cx={p.x} cy={p.y} r="19" fill={fills[index % fills.length]} />
              <text x={p.x} y={p.y + 4} fill={index % 6 === 2 || index % 6 === 3 || index % 6 === 4 ? '#10221c' : '#fff'} fontSize="10" fontWeight="800" textAnchor="middle">{initials(player.name)}</text>
              <text x={p.x} y={p.y + 32} fill="#F5F5F7" fontSize="9" textAnchor="middle">{player.name.split(' ')[0]}</text>
            </g>
          );
        })}
      </svg>
      <div className="graph-legend">קו עבה יותר מציין היכרות חזקה יותר.</div>
    </div>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M6 6H4v1a4 4 0 0 0 4 4"/><path d="M18 6h2v1a4 4 0 0 1-4 4"/><path d="M12 12v4"/><path d="M8.5 20h7"/><path d="M10 16h4v4h-4z"/>
    </svg>
  );
}

function Final({ room, socket, setError }: { room: RoomView; socket: Socket; setError: (v: string) => void }) {
  const [tab, setTab] = useState<'graph' | 'pairs'>('graph');
  const sorted = [...room.participants].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'he'));
  const winner = sorted[0];
  const newGame = async () => {
    const res = await emitAck(socket, 'game:new', {});
    if (!res.ok) setError(res.error || 'לא ניתן ליצור משחק חדש.');
  };
  return (
    <div className="content screen-final">
      <Brand roomCode={room.code} />
      <div className="icon-box"><TrophyIcon /></div>
      <div className="winner">
        <div className="winner-name">{winner?.name || 'המשחק הסתיים'}</div>
        <div className="winner-score">{winner ? `מקום ראשון עם ${winner.score} נקודות` : ''}</div>
      </div>
      <div className="card">
        <ScoreTable players={room.participants} />
      </div>
      <div className="tabs">
        <button className={`tab${tab === 'graph' ? ' active' : ''}`} onClick={() => setTab('graph')}>מפת חברויות</button>
        <button className={`tab${tab === 'pairs' ? ' active' : ''}`} onClick={() => setTab('pairs')}>כל הזיווגים</button>
      </div>
      {tab === 'graph' ? <FriendshipGraph room={room} /> : (
        <div>
          {room.allRounds.map((round) => (
            <div className="round-block" key={round.roundNumber}>
              <div className="round-heading"><span>סבב {round.roundNumber}</span><span className="small">{round.pairs.length} זיווגים</span></div>
              <RoundPairs result={round} />
            </div>
          ))}
        </div>
      )}
      <div className="spacer" />
      {room.self.isHost ? (
        <div className="actions">
          <button className="btn btn-primary" onClick={newGame}>צור משחק חדש עם אותם משתתפים</button>
        </div>
      ) : null}
    </div>
  );
}

export default function Page() {
  useAutomaticFullscreen();
  const socketRef = useRef<Socket | null>(null);
  const [socketReady, setSocketReady] = useState(false);
  const [room, setRoom] = useState<RoomView | null>(null);
  const [initialCode, setInitialCode] = useState('');
  const [initialInvite, setInitialInvite] = useState('');
  const [origin, setOrigin] = useState('http://localhost:3000');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lastHostTurnKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!room || room.phase !== 'turn' || !room.self.isHost || !room.currentDescriber) {
      lastHostTurnKeyRef.current = null;
      return;
    }
    const turnKey = `${room.roundNumber}:${room.currentDescriber.id}`;
    if (lastHostTurnKeyRef.current === turnKey) return;
    lastHostTurnKeyRef.current = turnKey;
    playHostTurnJingle();
  }, [room?.phase, room?.roundNumber, room?.currentDescriber?.id, room?.self.isHost]);

  const updateUrl = useCallback((code: string, resumeToken: string) => {
    window.history.replaceState({}, '', buildSessionUrl(window.location.href, code, resumeToken));
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    setOrigin(window.location.origin);
    fetch('/api/runtime-config', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((config: { publicOrigin?: string } | null) => {
        if (config?.publicOrigin) setOrigin(config.publicOrigin);
      })
      .catch(() => undefined);
    const params = new URLSearchParams(window.location.search);
    const code = normalizeRoomCode(params.get('room') || '');
    const invite = params.get('invite') || '';
    const resumeToken = readResumeToken(window.location.hash);
    setInitialCode(code);
    setInitialInvite(invite);

    let disposed = false;
    let socket: Socket | null = null;

    const connect = async () => {
      try {
        await fetch('/api/browser-session', { method: 'POST', credentials: 'same-origin' });
      } catch {
        // The resume token remains a fallback if the cookie endpoint is temporarily unavailable.
      }
      if (disposed) return;

      socket = io({ transports: ['websocket', 'polling'], closeOnBeforeunload: true });
      socketRef.current = socket;
      socket.on('connect', async () => {
        setSocketReady(true);
        if (!code && !invite) return;

        const bySession = await emitAck(socket!, 'room:resume-session', {
          code: code || undefined,
          invite: invite || undefined,
        });
        if (bySession.ok && bySession.roomCode && bySession.resumeToken) {
          updateUrl(bySession.roomCode, bySession.resumeToken);
          setInitialCode(bySession.roomCode);
          setInitialInvite('');
          void emitAck(socket!, 'room:sync', {});
          return;
        }

        if (code && resumeToken) {
          const byToken = await emitAck(socket!, 'room:reconnect', { code, resumeToken });
          if (byToken.ok) {
            void emitAck(socket!, 'room:sync', {});
            return;
          }
        }

        if (resumeToken) {
          window.history.replaceState({}, '', '/');
          setInitialCode('');
          setInitialInvite('');
          setError('החדר כבר לא קיים או שה-session פג.');
        }
      });
      socket.on('room:state', (state: RoomView) => {
        setRoom(state);
        setError('');
      });
      socket.on('room:closed', ({ reason }: { reason?: string }) => {
        setRoom(null);
        setInitialCode('');
        setInitialInvite('');
        window.history.replaceState({}, '', '/');
        setError(reason || 'החדר נסגר.');
      });
      socket.on('disconnect', () => setSocketReady(false));
    };

    void connect();
    return () => {
      disposed = true;
      socket?.disconnect();
    };
  }, [updateUrl]);

  useEffect(() => {
    if (!socketReady || !room || !socketRef.current) return;
    const sync = () => {
      socketRef.current?.emit('room:sync', {}, () => undefined);
    };
    sync();
    const timer = window.setInterval(sync, 2500);
    return () => window.clearInterval(timer);
  }, [socketReady, room?.code]);

  const identity = useCallback((roomCode: string, resumeToken: string) => {
    updateUrl(roomCode, resumeToken);
    setInitialCode(roomCode);
    setInitialInvite('');
  }, [updateUrl]);

  const socket = socketRef.current;
  const screen = useMemo(() => {
    if (!socket || !socketReady) return <div className="content"><Brand /><div className="spacer"/><div className="center small">מתחבר לשרת...</div><div className="spacer"/></div>;
    if (!room) return <Home socket={socket} initialCode={initialCode} initialInvite={initialInvite} onIdentity={identity} busy={busy} setBusy={setBusy} error={error} setError={setError} />;
    if (room.phase === 'lobby') return <Lobby room={room} socket={socket} origin={origin} setError={setError} />;
    if (room.phase === 'prep') return <Prep room={room} socket={socket} setError={setError} />;
    if (room.phase === 'turn') return <Turn room={room} socket={socket} setError={setError} />;
    if (room.phase === 'roundResults') return <RoundResults room={room} socket={socket} setError={setError} />;
    return <Final room={room} socket={socket} setError={setError} />;
  }, [socket, socketReady, room, initialCode, initialInvite, identity, busy, error, origin]);

  return (
    <main className="shell">
      <section className="phone">
        {room?.notice ? (
          <div style={{ padding: '14px 18px 0' }}>
            <div className="notice">{room.notice}</div>
          </div>
        ) : null}
        {error && room ? <div style={{ padding: '12px 18px 0' }}><div className="error">{error}</div></div> : null}
        {screen}
      </section>
    </main>
  );
}
