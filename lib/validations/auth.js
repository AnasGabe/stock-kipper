// FILE: lib/validations/auth.js
// Validasi input untuk login & manajemen user memakai Zod.
// VALIDASI INI DITERAPKAN DI SERVER — input dari browser tidak boleh dipercaya.

import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Format email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

// email di-lowercase agar tidak ada duplikasi seperti "Admin@X.com" dan "admin@x.com"
export const emailSchema = z
  .string()
  .trim()
  .email('Format email tidak valid')
  .max(150)
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, 'Password minimal 8 karakter')
  .max(100, 'Password terlalu panjang');

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(100, 'Nama terlalu panjang'),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['admin', 'staff'], { message: 'Role tidak valid' }),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(100, 'Nama terlalu panjang'),
  role: z.enum(['admin', 'staff'], { message: 'Role tidak valid' }),
  active: z.boolean(),
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});