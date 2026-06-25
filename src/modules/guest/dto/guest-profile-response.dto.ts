import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GuestProfileResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  guestId!: string;

  @ApiPropertyOptional({ example: 'PlayerOne', nullable: true })
  name!: string | null;
}
