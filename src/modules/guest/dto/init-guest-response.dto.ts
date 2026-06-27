export class InitGuestResponseDto {
  guestId!: string;
  sessionToken!: string;
  sessionTokenExpiresAt!: string;
  relinked!: boolean;
  /** Returned once on guest creation when installId is provided. Store securely for reinstall. */
  installSecret?: string;
}
