import { IsString, MaxLength } from 'class-validator';

export class StartRewardDto {
  @IsString()
  @MaxLength(64)
  placement!: string;
}
