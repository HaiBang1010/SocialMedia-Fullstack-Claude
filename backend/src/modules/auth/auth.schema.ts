import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username tối thiểu 3 ký tự')
    .max(24, 'Username tối đa 24 ký tự')
    .regex(/^[a-z0-9._]+$/, 'Username chỉ chứa chữ thường, số, dấu chấm và gạch dưới'),
  email: z.string().email('Email không hợp lệ'),
  password: z
    .string()
    .min(8, 'Password tối thiểu 8 ký tự')
    .max(72, 'Password tối đa 72 ký tự'), // bcrypt giới hạn 72 bytes
  name: z.string().min(1, 'Tên không được để trống').max(40),
});

export const loginSchema = z.object({
  // Cho phép login bằng email hoặc username
  identifier: z.string().min(1, 'Cần nhập email hoặc username'),
  password: z.string().min(1, 'Cần nhập password'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Cần refresh token'),
});

// Type inference từ schema — đỡ phải khai báo type riêng
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
