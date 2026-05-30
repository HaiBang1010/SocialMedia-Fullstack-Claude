import { prisma } from '../../lib/prisma';
import { AppError } from '../../middleware/error';
import type { UpdateProfileInput } from './users.schema';

const publicUserSelect = {
  id: true,
  username: true,
  name: true,
  bio: true,
  avatarUrl: true,
  isPrivate: true,
  createdAt: true,
} as const;

export async function getUserByUsername(username: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: publicUserSelect,
  });

  if (!user) {
    throw new AppError(404, 'UserNotFound', 'User not found');
  }

  return user;
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  // Loại bỏ các field undefined / empty string
  const data: any = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.bio !== undefined) data.bio = input.bio;
  if (input.avatarUrl !== undefined) {
    data.avatarUrl = input.avatarUrl === '' ? null : input.avatarUrl;
  }
  if (input.isPrivate !== undefined) data.isPrivate = input.isPrivate;

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: { ...publicUserSelect, email: true },
  });

  return user;
}
