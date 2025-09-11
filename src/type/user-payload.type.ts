export type UserPayload =
  | {
      source: 'firebase';
      uid: string;
      email: string;
      name?: string;
      picture?: string;
    }
  | {
      source: 'local';
      uid: string; // Changed from userId to uid for consistency
      email: string;
      name?: string;
    };
