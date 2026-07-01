export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  generate(): string;
}

export interface TokenIssuer {
  issueFor(profileId: string): string;
}
