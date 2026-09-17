import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SALT_BYTES = 16;
const KEY_BYTES = 64;

// scrypt is memory-hard, so it stays slow to brute force even on a GPU.
// Node's defaults (N=16384, r=8, p=1) take tens of milliseconds per hash.
function deriveKey(password: string, salt: string, keyBytes: number) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, keyBytes, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

/** Returns `salt:key`, both in hex. A fresh random salt makes equal passwords hash differently. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const key = await deriveKey(password, salt, KEY_BYTES);
  return `${salt}:${key.toString('hex')}`;
}

/** Compares in constant time, so the answer does not leak how much of the hash matched. */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, keyHex] = stored.split(':');
  if (!salt || !keyHex) {
    return false;
  }

  const expected = Buffer.from(keyHex, 'hex');
  if (expected.length === 0) {
    return false;
  }

  const actual = await deriveKey(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}
