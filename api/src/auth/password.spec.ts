import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('hashes the same password into different values, because each hash uses a random salt', async () => {
    const [first, second] = await Promise.all([
      hashPassword('demo-password'),
      hashPassword('demo-password'),
    ]);

    expect(first).not.toEqual(second);
    expect(first).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  it('verifies the right password', async () => {
    const stored = await hashPassword('demo-password');

    await expect(verifyPassword('demo-password', stored)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('demo-password');

    await expect(verifyPassword('wrong-password', stored)).resolves.toBe(false);
  });

  it('rejects a stored value that is not a salt and a hash', async () => {
    await expect(verifyPassword('demo-password', 'garbage')).resolves.toBe(
      false,
    );
  });
});
