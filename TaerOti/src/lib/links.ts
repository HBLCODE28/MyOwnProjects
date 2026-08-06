export const INVITE_PARAM = 'invite';
export const ROOM_PARAM = 'room';
export const RESUME_HASH_PARAM = 'resume';

export function buildInviteUrl(origin: string, inviteToken: string) {
  const url = new URL('/', origin);
  url.searchParams.set(INVITE_PARAM, inviteToken);
  return url.toString();
}

export function buildSessionUrl(currentUrl: string, roomCode: string, resumeToken: string) {
  const url = new URL(currentUrl);
  url.search = '';
  url.searchParams.set(ROOM_PARAM, roomCode);
  const hash = new URLSearchParams();
  hash.set(RESUME_HASH_PARAM, resumeToken);
  url.hash = hash.toString();
  return url.toString();
}

export function readResumeToken(hash: string) {
  return new URLSearchParams(hash.replace(/^#/, '')).get(RESUME_HASH_PARAM) || '';
}

export function isInviteToken(value: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}
