import { verifyInstallSecret, hashInstallSecret } from '@/common/utils/install-secret.util';

describe('install-secret.util', () => {
  it('verifies matching install secret', () => {
    const secret = '550e8400-e29b-41d4-a716-446655440000';
    const hash = hashInstallSecret(secret);
    expect(verifyInstallSecret(secret, hash)).toBe(true);
  });

  it('rejects wrong install secret', () => {
    const hash = hashInstallSecret('550e8400-e29b-41d4-a716-446655440000');
    expect(verifyInstallSecret('660e8400-e29b-41d4-a716-446655440001', hash)).toBe(false);
  });
});
