import { prisma } from '../../lib/prisma';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt';
import { AppError } from '../../middleware/error';
import type { RegisterInput, LoginInput } from './auth.schema';

/**
 * Public user shape — KHÔNG bao gồm passwordHash.
 * Mọi response trả user đều dùng shape này.
 */
const publicUserSelect = {
  id: true,
  username: true,
  email: true,
  name: true,
  bio: true,
  avatarUrl: true,
  isPrivate: true,
  createdAt: true,
} as const;

function generateTokens(user: { id: string; username: string }) {
  return {
    accessToken: signAccessToken({ sub: user.id, username: user.username }),
    refreshToken: signRefreshToken({ sub: user.id, username: user.username }),
  };
}

export async function register(input: RegisterInput) {
  const passwordHash = await hashPassword(input.password);

  // Prisma unique constraint sẽ throw P2002 nếu trùng → error middleware xử lý
  const user = await prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      passwordHash,
      name: input.name,
    },
    select: publicUserSelect,
  });

  const tokens = generateTokens(user);
  return { user, ...tokens };
}

export async function login(input: LoginInput) {
  // Tìm user bằng email HOẶC username
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: input.identifier }, { username: input.identifier }],
    },
  });

  if (!user) {
    // Lưu ý: KHÔNG nên tiết lộ "user không tồn tại" vs "sai password"
    // → giúp tránh user enumeration attack
    throw new AppError(401, 'InvalidCredentials', 'Invalid email/username or password');
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'InvalidCredentials', 'Invalid email/username or password');
  }

  const tokens = generateTokens(user);
  // Bóc passwordHash ra trước khi trả
  const { passwordHash: _, ...publicUser } = user;
  return { user: publicUser, ...tokens };
}

export async function refresh(refreshToken: string) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError(401, 'InvalidRefreshToken', 'Invalid or expired refresh token');
  }

  // Đảm bảo user vẫn tồn tại (có thể đã bị xóa)
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: publicUserSelect,
  });

  if (!user) {
    throw new AppError(401, 'UserNotFound', 'User no longer exists');
  }

  // Cấp access token mới (không cấp refresh mới — pattern đơn giản)
  return {
    accessToken: signAccessToken({ sub: user.id, username: user.username }),
  };
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  if (!user) {
    throw new AppError(404, 'UserNotFound', 'User not found');
  }

  return user;
}
