import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  ForbiddenProfileAccessError,
  ProfileNotFoundError,
} from '../../domain/errors/domain.errors';
import { ProfileStatus } from '../../domain/enums/profile.enums';
import { CreateProfileUseCase } from '../../application/use-cases/create-profile.use-case';
import { UpdateProfileUseCase } from '../../application/use-cases/update-profile.use-case';
import { DeleteProfileUseCase } from '../../application/use-cases/delete-profile.use-case';
import { GetProfileByIdUseCase } from '../../application/use-cases/get-profile-by-id.use-case';
import { SearchProfilesUseCase } from '../../application/use-cases/search-profiles.use-case';
import {
  CreateProfileInput,
  CreateProfileResultType,
  ProfileSearchResultType,
  ProfileType,
  UpdateProfileInput,
} from './profile.types';
import { hitToProfileType, toProfileType } from './profile.mapper';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@Resolver(() => ProfileType)
export class ProfileResolver {
  constructor(
    private readonly createProfileUseCase: CreateProfileUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
    private readonly deleteProfileUseCase: DeleteProfileUseCase,
    private readonly getProfileByIdUseCase: GetProfileByIdUseCase,
    private readonly searchProfilesUseCase: SearchProfilesUseCase,
  ) {}

  @Query(() => ProfileType, { nullable: true })
  async profile(@Args('id', { type: () => ID }) id: string): Promise<ProfileType | null> {
    try {
      const profile = await this.getProfileByIdUseCase.execute(id);
      return toProfileType(profile);
    } catch (error) {
      if (error instanceof ProfileNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  @Query(() => ProfileSearchResultType)
  async searchProfiles(
    @Args('query', { type: () => String, nullable: true }) query?: string,
    @Args('status', { type: () => ProfileStatus, nullable: true }) status?: ProfileStatus,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 20 }) limit?: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 }) offset?: number,
  ): Promise<ProfileSearchResultType> {
    const result = await this.searchProfilesUseCase.execute({ query, status, limit, offset });
    return {
      items: result.items.map(hitToProfileType),
      total: result.total,
    };
  }

  @Mutation(() => CreateProfileResultType)
  async createProfile(
    @Args('input') input: CreateProfileInput,
  ): Promise<CreateProfileResultType> {
    const { profile, accessToken } =
      await this.createProfileUseCase.execute(input);
    return { profile: toProfileType(profile), accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => ProfileType)
  async updateProfile(
    @Args('input') input: UpdateProfileInput,
    @CurrentUser() currentUserId: string,
  ): Promise<ProfileType> {
    if (currentUserId !== input.id) {
      throw new ForbiddenProfileAccessError(input.id);
    }
    const profile = await this.updateProfileUseCase.execute(input);
    return toProfileType(profile);
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => Boolean)
  async deleteProfile(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() currentUserId: string,
  ): Promise<boolean> {
    if (currentUserId !== id) {
      throw new ForbiddenProfileAccessError(id);
    }
    return this.deleteProfileUseCase.execute(id);
  }
}
