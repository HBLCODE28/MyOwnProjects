export type Phase = 'lobby' | 'prep' | 'turn' | 'roundResults' | 'final';

export type PublicPlayer = {
  id: string;
  name: string;
  avatarId: string;
  connected: boolean;
  isHost: boolean;
  score: number;
};

export type PairResult = {
  describerId: string;
  describerName: string;
  targetId: string;
  targetName: string;
  firstCorrectGuesserId: string | null;
  firstCorrectGuesserName: string | null;
  guessed: boolean;
  describerPoints: number;
  guesserPoints: number;
};

export type RoundResult = {
  roundNumber: number;
  pairs: PairResult[];
};

export type FriendshipEdge = {
  a: string;
  b: string;
  weight: number;
};

export type RoomView = {
  code: string;
  inviteToken: string | null;
  phase: Phase;
  totalRounds: number;
  roundNumber: number;
  participants: PublicPlayer[];
  self: {
    id: string;
    name: string;
    avatarId: string;
    isHost: boolean;
    targetName: string | null;
    assignedTargetId: string | null;
    selectedGuessId: string | null;
    selectedGuessAutomatic: boolean;
    selectedGuessTargetName: string | null;
    usedGuessTargetIds: string[];
    prepReady: boolean;
  };
  prepReadyCount: number;
  prepReadyTotal: number;
  timerEndsAt: number | null;
  currentDescriber: PublicPlayer | null;
  turnOrder: Array<{ id: string; name: string; current: boolean }>;
  roundResult: RoundResult | null;
  allRounds: RoundResult[];
  friendshipEdges: FriendshipEdge[];
  notice: string | null;
  canStart: boolean;
  minPlayers: number;
  maxRounds: number;
};
