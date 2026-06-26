export class ClaimRewardResponseDto {
  reward!: {
    type: string;
    amount: number;
  };
  success!: boolean;
  placement!: string;
}
