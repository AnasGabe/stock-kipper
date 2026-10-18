import { z } from 'zod';
import {
  JENIS_VALUES, TUJUAN_VALUES, DEFAULT_DEPT_PROSES, MAX_QTY,
  MACHINE_REQUIRED_FOR_INJ, isTujuanInj, buildKeteranganExtra, buildDocNoPrefix,
  CATEGORY_CODES,
} from '../constants/bkb.js';

const MAX_DEC = 3;
const validDec = (n) => Math.abs(Math.round(n*10**MAX_DEC) - n*10**MAX_DEC) < 1e-6;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Tanggal harus YYYY-MM-DD')
  .refine((v)=>!isNaN(Date.parse(`${v}T00:00:00Z`))&&new Date(`${v}T00:00:00Z`).toISOString().slice(0,10)===v,'Tanggal tidak valid');

export const bkbItemSchema = z.object({
  itemId:      z.coerce.number({message:'Barang wajib dipilih'}).int().positive('Barang wajib dipilih'),
  qty:         z.coerce.number({message:'QTY harus angka'}).positive('QTY harus lebih dari 0')
                  .max(MAX_QTY).refine(validDec,`QTY maks ${MAX_DEC} desimal`),
  deptPemakai: z.string().trim().min(1,'Dept Pemakai wajib diisi').max(20),
  deptProses:  z.string().trim().max(20).default(DEFAULT_DEPT_PROSES)
                  .transform((v)=>v||DEFAULT_DEPT_PROSES),
});

export const bkbSchema = z.object({
  jenis:       z.enum(JENIS_VALUES,{message:'Jenis transaksi tidak valid'}),
  bkbKategori: z.enum(CATEGORY_CODES,{message:'Kategori barang wajib dipilih'}),
  docNo:       z.string().trim().min(1,'No Dokumen wajib diisi').max(30)
                  .regex(/^[A-Za-z0-9][A-Za-z0-9\-\/. ]*$/,'No Dokumen hanya boleh huruf, angka, - / .')
                  .transform((v)=>v.toUpperCase()),
  bkbDate:     dateStr,
  reference:   z.union([z.enum(['1','2','3']),z.literal('')]).optional().default(''),
  tujuan:      z.enum(TUJUAN_VALUES,{message:'Tujuan wajib dipilih'}),
  inisial:     z.string().trim().min(1,'Inisial wajib diisi').max(6).transform((v)=>v.toUpperCase()),
  nomorUrut:   z.coerce.number().int().min(1).max(9999),
  machine:     z.string().trim().max(40).default(''),
  items:       z.array(bkbItemSchema).min(1,'Minimal satu barang').max(50),
})
.superRefine((d,ctx)=>{
  const inj = isTujuanInj(d.tujuan);
  if (!inj && d.machine) ctx.addIssue({code:'custom',path:['machine'],message:'Mesin hanya untuk Tujuan INJ'});
  if (inj && MACHINE_REQUIRED_FOR_INJ && !d.machine) ctx.addIssue({code:'custom',path:['machine'],message:'Mesin wajib untuk Tujuan INJ'});
  const seen = new Set();
  d.items.forEach((r,i)=>{
    if(seen.has(r.itemId)) ctx.addIssue({code:'custom',path:['items',i,'itemId'],message:'Barang sudah ada di daftar'});
    seen.add(r.itemId);
  });
})
.transform((d)=>({
  ...d,
  machine:         isTujuanInj(d.tujuan) ? d.machine : '',
  keteranganType:  d.tujuan,
  keteranganExtra: `${d.inisial}/${d.nomorUrut}`,
  keterangan:      buildKeteranganExtra(d.tujuan, d.inisial, d.nomorUrut),
}));

export const bkbListSchema = z.object({
  search:    z.string().trim().max(100).optional().default(''),
  jenis:     z.union([z.enum(JENIS_VALUES),z.literal('')]).optional().default(''),
  startDate: z.union([dateStr,z.literal('')]).optional().default(''),
  endDate:   z.union([dateStr,z.literal('')]).optional().default(''),
  page:      z.coerce.number().int().min(1).optional().default(1),
  limit:     z.coerce.number().int().min(1).max(50).optional().default(15),
});
