import { registerEnumType, ObjectType, Field, ID, Int, InputType } from '@nestjs/graphql';
import { ProfileStatus } from '../../domain/enums/profile.enums';

registerEnumType(ProfileStatus, { name: 'ProfileStatus' });

@ObjectType()
export class ProfileType {
  @Field(() => ID)
  id!: string;

  @Field()
  username!: string;

  @Field()
  email!: string;

  @Field()
  displayName!: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;

  @Field(() => ProfileStatus)
  status!: ProfileStatus;

  @Field(() => Int)
  version!: number;

  @Field()
  createdAt!: string;

  @Field()
  updatedAt!: string;
}

@ObjectType()
export class ProfileSearchResultType {
  @Field(() => [ProfileType])
  items!: ProfileType[];

  @Field(() => Int)
  total!: number;
}

@InputType()
export class CreateProfileInput {
  @Field()
  username!: string;

  @Field()
  email!: string;

  @Field()
  displayName!: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;
}

@InputType()
export class UpdateProfileInput {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  version!: number;

  @Field({ nullable: true })
  displayName?: string;

  @Field(() => String, { nullable: true })
  avatarUrl?: string | null;

  @Field(() => ProfileStatus, { nullable: true })
  status?: ProfileStatus;
}
