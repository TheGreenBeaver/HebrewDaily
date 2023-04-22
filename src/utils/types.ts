export type Ensure<T> = Exclude<T, null | undefined>;

export type Maybe<T> = T | null | undefined;

export type OneOrMany<T> = T | T[];