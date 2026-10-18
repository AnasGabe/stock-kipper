'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Spinner from '@/components/ui/Spinner';

export default function UserFormModal({ open, onClose, existing, currentUserId, onSave }) {
  const isEdit = Boolean(existing);
  const isSelf = existing?.id === currentUserId;

  const [form, setForm] = useState({ name: '', email: '', role: 'staff', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setForm({ name: existing.name, email: existing.email, role: existing.role, password: '', confirmPassword: '' });
    } else {
      setForm({ name: '', email: '', role: 'staff', password: '', confirmPassword: '' });
    }
    setErrors({});
  }, [open, existing]);

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrors({});

    const nextErrors = {};
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim()) nextErrors.name = 'Nama wajib diisi.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nextErrors.email = 'Format email tidak valid.';
    if (isEdit) {
      // di mode edit role/status akun sendiri dikunci (dicek juga di server)
      if (isSelf && form.role !== existing.role) nextErrors.role = 'Tidak bisa mengubah role akun sendiri.';
    } else {
      if (form.password.length < 8) nextErrors.password = 'Password minimal 8 karakter.';
      if (form.password && form.password !== form.confirmPassword) {
        nextErrors.confirmPassword = 'Ulangi password harus sama.';
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setBusy(true);
    try {
      if (isEdit) {
        // payload untuk endpoint PUT /api/users/:id (role akun sendiri dipaksa tetap)
        const role = isSelf ? existing.role : form.role;
        await onSave({ name: form.name.trim(), role, active: existing.active });
      } else {
        // payload untuk endpoint POST /api/users (buat baru)
        await onSave({ name: form.name.trim(), email, role: form.role, password: form.password });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit User' : 'Tambah User'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nama" error={errors.name}>
          <input
            type="text"
            value={form.name}
            onChange={(event) => setField('name', event.target.value)}
            placeholder="Nama lengkap"
            className={inputClass(errors.name)}
          />
        </Field>

        <Field label="Email" error={errors.email}>
          <input
            type="email"
            value={form.email}
            disabled={isEdit}
            onChange={(event) => setField('email', event.target.value)}
            placeholder="nama@perusahaan.com"
            className={inputClass(errors.email, isEdit)}
          />
          {isEdit && <p className="mt-1 text-xs text-slate-400">Email tidak bisa diubah.</p>}
        </Field>

        <Field label="Role" error={errors.role}>
          <div className="grid grid-cols-2 gap-2">
            {['staff', 'admin'].map((role) => (
              <button
                key={role}
                type="button"
                disabled={isSelf}
                onClick={() => setField('role', role)}
                className={
                  form.role === role
                    ? 'rounded-xl border-2 border-brand-600 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 dark:bg-brand-900/30'
                    : 'rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'
                }
              >
                {role === 'admin' ? 'Admin' : 'Staff'}
              </button>
            ))}
          </div>
          {isSelf && <p className="mt-1 text-xs text-slate-400">Role akun sendiri tidak bisa diubah.</p>}
        </Field>

        {!isEdit && (
          <>
            <Field label="Password Awal" error={errors.password} hint="Minimal 8 karakter">
              <input
                type="password"
                value={form.password}
                onChange={(event) => setField('password', event.target.value)}
                placeholder="********"
                className={inputClass(errors.password)}
              />
            </Field>
            <Field label="Ulangi Password" error={errors.confirmPassword}>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setField('confirmPassword', event.target.value)}
                placeholder="********"
                className={inputClass(errors.confirmPassword)}
              />
            </Field>
          </>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy && <Spinner className="h-4 w-4" />}
            {busy ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, hint, error, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function inputClass(hasError, disabled) {
  return (
    'w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 ' +
    'dark:border-slate-700 dark:bg-slate-800 dark:text-white ' +
    (hasError ? 'border-rose-400 focus:border-rose-400' : '') +
    (disabled ? ' cursor-not-allowed opacity-60' : '')
  );
}