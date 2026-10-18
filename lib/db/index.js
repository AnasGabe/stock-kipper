// FILE: lib/db/index.js
// Pintu utama database. Sekarang hanya satu adapter: Supabase (PostgreSQL).
import { validateEnv } from '../env.js';
import { getSupabaseRepository } from './supabase.js';

let repositoryCache = null;

export function getRepository() {
  if (repositoryCache) return repositoryCache;
  validateEnv();
  repositoryCache = getSupabaseRepository();
  return repositoryCache;
}
