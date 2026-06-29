import { Transform } from 'class-transformer';
import { Matches, IsString, MaxLength, MinLength } from 'class-validator';

const GUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class UpdateGuestNameDto {
  @IsString()
  @Matches(GUEST_ID_PATTERN, { message: 'guestId must be a UUID' })
  guestId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  name!: string;
}
