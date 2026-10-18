import { z } from 'zod';
import { CATEGORY_CODES, MAX_QTY } from '../constants/bkb.js';

export const itemSchema = z.object({
  categoryCode: z.enum(CATEGORY_CODES,{message:'Kategori wajib dipilih'}),
  itemCode:     z.string().trim().min(1,'Kode barang wajib diisi').max(50),
  barcode:      z.string().trim().max(100).optional().default(''),
  name:         z.string().trim().min(1,'Nama barang wajib diisi').max(150),
  unit:         z.string().trim().min(1,'Satuan wajib diisi').max(20),
  quantity:     z.coerce.number({message:'Saldo harus angka'}).min(0).max(MAX_QTY),
});

export const listOptionsSchema = z.object({
  search:       z.string().trim().max(100).optional().default(''),
  categoryCode: z.union([z.enum(CATEGORY_CODES),z.literal('')]).optional().default(''),
  sortBy:       z.enum(['name','itemCode','quantity','updatedAt']).optional().default('itemCode'),
  sortOrder:    z.enum(['asc','desc']).optional().default('asc'),
  page:         z.coerce.number().int().min(1).optional().default(1),
  limit:        z.coerce.number().int().min(1).max(100).optional().default(15),
});

export const searchSchema = z.object({
  q:    z.string().trim().max(60).optional().default(''),
  code: z.string().trim().max(100).optional().default(''),
  ids:  z.string().regex(/^\d+(,\d+){0,49}$/,'ids tidak valid').optional(),
});
