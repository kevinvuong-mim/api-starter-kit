import { IsString, Matches } from 'class-validator';

const GUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class GuestIdQueryDto {
  @IsString()
  @Matches(GUEST_ID_PATTERN, { message: 'guestId must be a UUID' })
  guestId!: string;
}
