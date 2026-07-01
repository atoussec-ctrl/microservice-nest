import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenIssuer } from '../../application/ports/application.port';

@Injectable()
export class JwtTokenIssuer implements TokenIssuer {
  constructor(private readonly jwtService: JwtService) {}

  issueFor(profileId: string): string {
    return this.jwtService.sign({ sub: profileId });
  }
}
