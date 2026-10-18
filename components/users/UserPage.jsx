// FILE: components/users/UserPage.jsx
// Halaman pengelolaan user (khusus admin): daftar, tambah, edit role/status,
// reset password, nonaktifkan/aktifkan, dan hapus user.

'use client';

import { useState } from 'react';
import { mutate } from 'swr';
import { useRealtimeSWR } from '@/hooks/useRealtimeSWR';
import { swrFetcher, apiFetch } from '@/lib/api-client';
import { useToast } from '@/components/ui/Toast';
import { RoleBadge } from '@/components/ui/Badge';
import Badge from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import UserFormModal from './UserFormModal';
import ResetPasswordModal from './ResetPasswordModal';
import { formatDateTime, formatNumber } from '@/lib/utils';

export default function UserPage({ currentUser }) {
  const toast = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resettingUser, setResettingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const { data, isLoading, error } = useRealtimeSWR('/api/users', swrFetcher, {
    subscribeTables: ['users'],
    fallbackData: {},
  });

  const users = data?.data || [];

  function refresh() {
    mutate('/api/users');
  }

  // ----- POST / PUT -----
  async function handleSaveUser(payload) {
    try {
      if (editingUser) {
        const result = await apiFetch(`/api/users/${editingUser.id}`, { method: 'PUT', body: payload });
        toast('Data user berhasil diubah.');
      } else {
        const result = await apiFetch('/api/users', { body: payload });
        toast(`User ${result.data.email} berhasil dibuat.`);
      }
      setEditingUser(null);
      refresh();
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan user.');
    }
  }

  // ----- reset password -----
  async function handleResetPassword({ password }) {
    try {
      await apiFetch(`/api/users/${resettingUser.id}/reset-password`, { body: { password } });
      toast('Password berhasil direset. Sesi lama user tersebut ditutup.');
      refresh();
    } catch (err) {
      toast.error(err.message || 'Gagal mereset password.');
    }
  }

  // ----- toggle aktif / nonaktif -----
  async function handleToggleActive(user) {
    try {
      const result = await apiFetch(`/api/users/${user.id}`, {
        method: 'PUT',
        body: { name: user.name, role: user.role, active: !user.active },
      });
      toast(`${user.name} ${user.active ? 'dinonaktifkan' : 'diaktifkan'}.`);
      refresh();
    } catch (err) {
      toast.error(err.message || 'Gagal mengubah status.');
    }
  }

  // ----- hapus -----
  async function handleDelete() {
    if (!deletingUser) return;
    setDeleteBusy(true);
    try {
      await apiFetch(`/api/users/${deletingUser.id}`, { method: 'DELETE' });
      toast('User berhasil dihapus.');
      setDeletingUser(null);
      refresh();
    } catch (err) {
      toast.error(err.message || 'Gagal menghapus user.');
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Pengguna</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola akun yang bisa masuk: {formatNumber(users.length)} pengguna.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingUser(null);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M12 5v14M5 12h14" />
          </svg>
          Tambah User
        </button>
      </div>

      {error ? (
        <EmptyState title="Gagal memuat data" description={error.message} />
      ) : isLoading ? (
        <SkeletonTable rows={5} />
      ) : users.length === 0 ? (
        <EmptyState title="Belum ada user" description="Tambahkan user pertama lewat tombol di atas." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Dibuat</th>
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {users.map((user) => {
                const isSelf = user.id === currentUser.id;
                return (
                  <tr key={user.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            {user.name}
                            {isSelf && <span className="ml-2 text-xs font-normal text-slate-400">(Anda)</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{user.email}</td>
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-4 py-3">
                      {user.active ? <Badge tone="green">Aktif</Badge> : <Badge tone="red">Nonaktif</Badge>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">{formatDateTime(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <ActionButton
                          title="Edit"
                          disabled={isSelf}
                          onClick={() => {
                            setEditingUser(user);
                            setFormOpen(true);
                          }}
                          className="hover:bg-amber-100 hover:text-amber-600 disabled:opacity-30 disabled:hover:bg-transparent"
                          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2.1 2.1 0 113 3L11 15l-4 1 1-4 8.6-8.4z" />}
                        />
                        <ActionButton
                          title="Reset password"
                          onClick={() => setResettingUser(user)}
                          disabled={!user.active}
                          className="hover:bg-sky-100 hover:text-sky-600 disabled:opacity-30 disabled:hover:bg-transparent"
                          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />}
                        />
                        <ActionButton
                          title={user.active ? 'Nonaktifkan' : 'Aktifkan'}
                          disabled={isSelf}
                          onClick={() => handleToggleActive(user)}
                          className="hover:bg-violet-100 hover:text-violet-600 disabled:opacity-30 disabled:hover:bg-transparent"
                          icon={
                            user.active ? (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636M13.364 10.636a2 2 0 01-2.728 2.728" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M13.732 13.732A3 3 0 018.2 10.2M7.5 7.5A9.86 9.86 0 003 12c2.3 3.6 6.1 6 10 6 1.4 0 2.7-.2 4-.7M16.6 16.6A9.86 9.86 0 0121 12c-2.3-3.6-6.1-6-10-6-1.4 0-2.7.2-4 .7" />
                            )
                          }
                        />
                        <ActionButton
                          title="Hapus"
                          disabled={isSelf}
                          onClick={() => setDeletingUser(user)}
                          className="hover:bg-rose-100 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent"
                          icon={<path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.14A2 2 0 0116.14 21H7.86a2 2 0 01-1.993-1.86L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16" />}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* modal form tambah/edit */}
      <UserFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingUser(null);
        }}
        existing={editingUser}
        currentUserId={currentUser.id}
        onSave={handleSaveUser}
      />

      {/* modal reset password */}
      <ResetPasswordModal
        open={Boolean(resettingUser)}
        onClose={() => setResettingUser(null)}
        user={resettingUser}
        onSave={handleResetPassword}
      />

      {/* dialog konfirmasi hapus */}
      <ConfirmDialog
        open={Boolean(deletingUser)}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDelete}
        busy={deleteBusy}
        title="Hapus User"
        message={`Yakin ingin menghapus "${deletingUser?.name}" (${deletingUser?.email})? Tindakan ini tidak bisa dibatalkan.`}
      />
    </div>
  );
}

function ActionButton({ title, onClick, icon, className = '', disabled = false }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition disabled:cursor-not-allowed dark:text-slate-400 ${className}`}
    >
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        {icon}
      </svg>
    </button>
  );
}