import { IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';

const INSTALL_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INSTALL_SECRET_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InitGuestDto {
  @IsOptional()
  @IsString()
  @MinLength(36)
  @MaxLength(36)
  @Matches(INSTALL_ID_PATTERN, { message: 'installId must be a UUID' })
  installId?: string;

  @ValidateIf((dto: InitGuestDto) => dto.installId !== undefined)
  @IsOptional()
  @IsString()
  @MinLength(36)
  @MaxLength(36)
  @Matches(INSTALL_SECRET_PATTERN, { message: 'installSecret must be a UUID' })
  installSecret?: string;
}
