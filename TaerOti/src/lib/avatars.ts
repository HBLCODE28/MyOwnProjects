export type Gender = 'female' | 'male';

export const AVATARS = [
  {
    id: 'woman',
    label: 'אישה',
    gender: 'female',
    imageUrl: 'https://www.svgrepo.com/show/420321/avatar-female-portrait.svg',
  },
  {
    id: 'man',
    label: 'גבר',
    gender: 'male',
    imageUrl: 'https://www.svgrepo.com/show/420344/avatar-man-person.svg',
  },
  {
    id: 'girl',
    label: 'ילדה',
    gender: 'female',
    imageUrl: 'https://www.svgrepo.com/show/420327/avatar-child-girl.svg',
  },
  {
    id: 'boy',
    label: 'ילד',
    gender: 'male',
    imageUrl: 'https://www.svgrepo.com/show/420351/avatar-boy-kid.svg',
  },
  {
    id: 'senior-woman',
    label: 'אישה מבוגרת',
    gender: 'female',
    imageUrl: 'https://www.svgrepo.com/show/420363/avatar-elderly-grandma.svg',
  },
  {
    id: 'senior-man',
    label: 'גבר מבוגר',
    gender: 'male',
    imageUrl: 'https://www.svgrepo.com/show/420359/male-man-old.svg',
  },
] as const;

export type AvatarId = typeof AVATARS[number]['id'];

export const DEFAULT_AVATAR_ID: AvatarId = 'woman';

export function normalizeAvatarId(value: unknown): AvatarId {
  return AVATARS.some((avatar) => avatar.id === value) ? value as AvatarId : DEFAULT_AVATAR_ID;
}

export function avatarDefinition(avatarId: string) {
  return AVATARS.find((avatar) => avatar.id === avatarId) ?? AVATARS[0];
}

export function avatarImageUrl(avatarId: string) {
  return avatarDefinition(avatarId).imageUrl;
}

export function avatarGender(avatarId: string): Gender {
  return avatarDefinition(avatarId).gender;
}

export function isFemaleAvatar(avatarId: string) {
  return avatarGender(avatarId) === 'female';
}
