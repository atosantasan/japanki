export type ProfileRefreshEpoch = {
  capture: () => number;
  invalidate: () => void;
  isCurrent: (token: number) => boolean;
};

export function createProfileRefreshEpoch(): ProfileRefreshEpoch {
  let epoch = 0;
  return {
    capture: () => epoch,
    invalidate: () => {
      epoch += 1;
    },
    isCurrent: (token: number) => token === epoch,
  };
}
