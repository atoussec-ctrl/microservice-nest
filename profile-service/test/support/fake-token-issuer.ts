import { TokenIssuer } from '../../src/application/ports/application.port';

export class FakeTokenIssuer implements TokenIssuer {
  issueFor(profileId: string): string {
    return `fake-token-for-${profileId}`;
  }
}
