import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInviteUrl, buildSessionUrl, isInviteToken, readResumeToken } from '../src/lib/links';
import { isRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from '../src/lib/room-code';

test('invite links contain only the high-entropy invite token', () => {
  const token = 'A'.repeat(43);
  const value = buildInviteUrl('https://game.example', token);
  const url = new URL(value);
  assert.equal(url.origin, 'https://game.example');
  assert.equal(url.searchParams.get('invite'), token);
  assert.equal(url.searchParams.has('room'), false);
  assert.equal(url.searchParams.has('p'), false);
  assert.equal(url.hash, '');
  assert.equal(isInviteToken(token), true);
  assert.equal(isInviteToken('ABCD'), false);
});

test('resume secret is stored in URL fragment, not query string', () => {
  const resume = 'R'.repeat(43);
  const value = buildSessionUrl('https://game.example/?invite=secret&p=old#old=1', '7Q3K9M2R', resume);
  const url = new URL(value);
  assert.equal(url.searchParams.get('room'), '7Q3K9M2R');
  assert.equal(url.searchParams.has('invite'), false);
  assert.equal(url.searchParams.has('p'), false);
  assert.equal(url.search.includes(resume), false);
  assert.equal(readResumeToken(url.hash), resume);
});


test('room codes are eight characters and normalize pasted separators', () => {
  assert.equal(ROOM_CODE_LENGTH, 8);
  assert.equal(normalizeRoomCode('7q3k-9m2r'), '7Q3K9M2R');
  assert.equal(normalizeRoomCode(' 7Q3K 9M2R '), '7Q3K9M2R');
  assert.equal(isRoomCode('7Q3K9M2R'), true);
  assert.equal(isRoomCode('7Q3K'), false);
  assert.equal(isRoomCode('7Q3K9M2RX'), false);
  assert.equal(isRoomCode('7Q3K9M2O'), false);
});

import { AVATARS, avatarGender, avatarImageUrl } from '../src/lib/avatars';

test('avatar catalog uses one illustrated source and maps each choice to a gender', () => {
  assert.equal(AVATARS.length, 6);
  for (const avatar of AVATARS) {
    assert.match(avatarImageUrl(avatar.id), /^https:\/\/www\.svgrepo\.com\/show\/\d+\/.+\.svg$/);
    assert.ok(avatarGender(avatar.id) === 'male' || avatarGender(avatar.id) === 'female');
  }
  assert.equal(avatarGender('woman'), 'female');
  assert.equal(avatarGender('girl'), 'female');
  assert.equal(avatarGender('senior-woman'), 'female');
  assert.equal(avatarGender('man'), 'male');
  assert.equal(avatarGender('boy'), 'male');
  assert.equal(avatarGender('senior-man'), 'male');
});
