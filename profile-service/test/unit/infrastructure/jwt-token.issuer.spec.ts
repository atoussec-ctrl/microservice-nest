import { JwtService } from '@nestjs/jwt';
import { JwtTokenIssuer } from '../../../src/infrastructure/auth/jwt-token.issuer';

describe('JwtTokenIssuer', () => {
  it('should_sign_a_token_with_the_profile_id_as_subject', () => {
    const jwtService = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
    } as unknown as JwtService;
    const issuer = new JwtTokenIssuer(jwtService);

    const token = issuer.issueFor('profile-123');

    expect(token).toBe('signed.jwt.token');
    expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'profile-123' });
  });
});
