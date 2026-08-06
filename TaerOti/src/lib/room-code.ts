export const ROOM_CODE_LENGTH = 8;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeRoomCode(value: unknown) {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '');
}

export function isRoomCode(value: unknown) {
  const code = normalizeRoomCode(value);
  return new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`).test(code);
}
