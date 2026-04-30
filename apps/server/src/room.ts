// In-memory room state — lost on restart, that's fine per spec

export interface BlobPosition {
  x: number;
  y: number;
}

export interface AudioState {
  bpm: number;
  subBassEnergy: number;
  dropActive: boolean;
}

export interface RoomState {
  activeSetId: string | null;
  audioState: AudioState;
  connectedAccountIds: Set<string>;
  blobPositions: Map<string, BlobPosition>;
}

const state: RoomState = {
  activeSetId: null,
  audioState: { bpm: 120, subBassEnergy: 0, dropActive: false },
  connectedAccountIds: new Set(),
  blobPositions: new Map(),
};

export const room = {
  getState: () => state,

  setActiveSet(setId: string | null) {
    state.activeSetId = setId;
  },

  updateAudio(audio: Partial<AudioState>) {
    Object.assign(state.audioState, audio);
  },

  addClient(accountId: string) {
    state.connectedAccountIds.add(accountId);
  },

  removeClient(accountId: string) {
    state.connectedAccountIds.delete(accountId);
    state.blobPositions.delete(accountId);
  },

  updatePosition(accountId: string, pos: BlobPosition) {
    state.blobPositions.set(accountId, pos);
  },

  getPosition(accountId: string): BlobPosition {
    return state.blobPositions.get(accountId) ?? { x: Math.random() * 10 - 5, y: 0 };
  },
};
