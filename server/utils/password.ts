import { scrypt, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const randomBytesAsync = promisify(randomBytes);

export const hashPassword = async (password: string) => {
  const salt = (await randomBytesAsync(16)).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
};

export const comparePasswords = async (password: string, hash: string) => {
  if (!hash) return false;
  const parts = hash.trim().split(':');
  if (parts.length !== 2) {
    console.log(`[Password] Unknown hash format: ${hash.substring(0, 20)}...`);
    return false;
  }
  const [salt, hashValue] = parts;
  const passwordHash = (await scryptAsync(password, salt, 64)) as Buffer;
  return passwordHash.toString('hex') === hashValue;
};
