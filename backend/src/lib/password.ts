import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

/**
 * Hash plaintext password trước khi lưu DB.
 * KHÔNG BAO GIỜ lưu password thô vào DB.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/**
 * So sánh password user nhập với hash trong DB.
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
