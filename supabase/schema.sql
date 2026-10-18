-- ============================================================
-- STOK HUB — SCHEMA FINAL (satu file, jalankan sekali di Supabase SQL Editor)
-- Untuk reset: jalankan seluruh file ini (BAGIAN 0 menghapus tabel lama)
-- Tabel users TIDAK dihapus (akun login aman)
-- ============================================================

-- ---------- 0) BERSIHKAN SKEMA LAMA ----------
drop table if exists public.stock_history      cascade;
drop table if exists public.transactions_log   cascade;
drop table if exists public.bkb_items          cascade;
drop table if exists public.bkb                cascade;
drop table if exists public.items              cascade;
drop function if exists public.create_bkb(jsonb,bigint,text);
drop function if exists public.create_item_master(jsonb,bigint,text);
drop function if exists public.update_item_master(bigint,jsonb,bigint,text);
drop function if exists public.notify_stok_changed();

-- ---------- 1) USERS (dipertahankan) ----------
create table if not exists public.users (
  id               bigserial primary key,
  name             text not null,
  email            text not null unique,
  password_hash    text not null,
  role             text not null default 'staff' check (role in ('admin','staff')),
  active           boolean not null default true,
  password_version integer not null default 1,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------- 2) MASTER BARANG ----------
-- barcode: nilai barcode fisik pada stiker barang (opsional, unik)
-- category_code 1 = Raw Material (lok 100), 4 = Barang Olahan (lok 800)
create table public.items (
  id             bigserial primary key,
  category_code  text not null check (category_code in ('1','4')),
  location_code  text not null,
  item_code      text not null,
  barcode        text,
  name           text not null,
  quantity       numeric(14,3) not null default 0 check (quantity >= 0),
  unit           text not null default 'pcs',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint items_location_matches_category check (
    (category_code = '1' and location_code = '100') or
    (category_code = '4' and location_code = '800')
  )
);
create unique index items_item_code_uq on public.items (upper(item_code));
create unique index items_barcode_uq   on public.items (barcode) where barcode is not null;
create index items_name_idx            on public.items (lower(name));

-- ---------- 3) HEADER BKB ----------
-- doc_no format: PB410-26I00001
--   jenis(2) + loc_code(3) + '-' + tahun2(2) + bulan_inisial(1) + urut(5)
-- bkb_kategori: '1'=Raw Material, '4'=Barang Olahan (menentukan 110/410)
-- keterangan_type: Tujuan (BIP, INJ1-4, IHW, RETUR, SA, DISTRIBUSI, RAKIT, TEMPEL, PROSES, HASIL)
-- keterangan_extra: INISIAL/NOMOR (mis. AND/1)
-- keterangan: gabungan (mis. BIP/AND/1)
-- machine: hanya terisi bila keterangan_type ILIKE 'INJ%'
create table public.bkb (
  id               bigserial primary key,
  doc_no           text not null,
  jenis            text not null check (jenis in ('PB','PR','RP','BTL','TRM')),
  bkb_kategori     text not null check (bkb_kategori in ('1','4')),
  bkb_date         date not null,
  reference        text,
  keterangan_type  text not null,
  keterangan_extra text,
  keterangan       text not null,
  machine          text,
  created_by       bigint references public.users(id) on delete set null,
  created_by_name  text,
  created_at       timestamptz not null default now(),
  constraint bkb_machine_only_for_inj check (
    machine is null or keterangan_type ilike 'INJ%'
  )
);
create unique index bkb_doc_no_uq on public.bkb (upper(doc_no));
create index bkb_date_idx         on public.bkb (bkb_date desc, id desc);

-- ---------- 4) DETAIL BARANG PER BKB ----------
create table public.bkb_items (
  id           bigserial primary key,
  bkb_id       bigint not null references public.bkb(id)   on delete cascade,
  item_id      bigint not null references public.items(id) on delete restrict,
  qty          numeric(14,3) not null check (qty > 0),
  dept_pemakai text not null,
  dept_proses  text not null default 'P1'
);
create index bkb_items_bkb_idx  on public.bkb_items (bkb_id);
create index bkb_items_item_idx on public.bkb_items (item_id);

-- ---------- 5) RIWAYAT MUTASI ----------
create table public.transactions_log (
  id             bigserial primary key,
  bkb_id         bigint references public.bkb(id)   on delete set null,
  jenis          text not null check (jenis in ('PB','PR','RP','BTL','TRM','SA','ADJ')),
  doc_no         text,
  keterangan     text,
  machine        text,
  item_id        bigint references public.items(id) on delete set null,
  item_code      text not null,
  item_name      text not null,
  qty            numeric(14,3) not null,
  direction      text not null check (direction in ('in','out')),
  balance_before numeric(14,3) not null,
  balance_after  numeric(14,3) not null,
  dept_pemakai   text,
  dept_proses    text,
  actor_id       bigint references public.users(id) on delete set null,
  actor_name     text,
  created_at     timestamptz not null default now()
);
create index txlog_created_idx on public.transactions_log (created_at desc, id desc);
create index txlog_item_idx    on public.transactions_log (item_id);

-- ---------- 6) FUNGSI ATOMIK: SIMPAN BKB ----------
create or replace function public.create_bkb(p jsonb, p_actor_id bigint, p_actor_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_jenis      text := p->>'jenis';
  v_dir        text;
  v_bkb_id     bigint;
  v_line       jsonb;
  v_item       public.items%rowtype;
  v_qty        numeric;
  v_before     numeric;
  v_after      numeric;
begin
  if v_jenis not in ('PB','PR','RP','BTL','TRM') then
    raise exception 'DATA_TIDAK_VALID|Jenis transaksi tidak valid';
  end if;
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'DATA_TIDAK_VALID|Minimal satu barang';
  end if;
  v_dir := case when v_jenis in ('PB','BTL') then 'out' else 'in' end;

  insert into public.bkb (doc_no, jenis, bkb_kategori, bkb_date, reference,
                           keterangan_type, keterangan_extra, keterangan, machine,
                           created_by, created_by_name)
  values (p->>'docNo', v_jenis, p->>'bkbKategori', (p->>'bkbDate')::date,
          nullif(trim(coalesce(p->>'reference','')), ''),
          p->>'keteranganType', p->>'keteranganExtra', p->>'keterangan',
          nullif(trim(coalesce(p->>'machine','')), ''),
          p_actor_id, p_actor_name)
  returning id into v_bkb_id;

  for v_line in
    select value from jsonb_array_elements(p->'items') order by (value->>'itemId')::bigint
  loop
    v_qty := (v_line->>'qty')::numeric;
    select * into v_item from public.items where id = (v_line->>'itemId')::bigint for update;
    if not found then
      raise exception 'BARANG_TIDAK_ADA|Barang id % tidak ditemukan', v_line->>'itemId';
    end if;
    v_before := v_item.quantity;
    v_after  := case when v_dir='out' then v_before - v_qty else v_before + v_qty end;
    if v_after < 0 then
      raise exception 'STOK_KURANG|%|%|%|%', v_item.item_code, v_item.name, v_before, v_qty;
    end if;
    update public.items set quantity = v_after, updated_at = now() where id = v_item.id;
    insert into public.bkb_items (bkb_id, item_id, qty, dept_pemakai, dept_proses)
    values (v_bkb_id, v_item.id, v_qty,
            trim(v_line->>'deptPemakai'),
            coalesce(nullif(trim(v_line->>'deptProses'),''),'P1'));
    insert into public.transactions_log
      (bkb_id, jenis, doc_no, keterangan, machine, item_id, item_code, item_name,
       qty, direction, balance_before, balance_after, dept_pemakai, dept_proses,
       actor_id, actor_name)
    values
      (v_bkb_id, v_jenis, p->>'docNo', p->>'keterangan',
       nullif(trim(coalesce(p->>'machine','')), ''),
       v_item.id, v_item.item_code, v_item.name,
       v_qty, v_dir, v_before, v_after,
       trim(v_line->>'deptPemakai'),
       coalesce(nullif(trim(v_line->>'deptProses'),''),'P1'),
       p_actor_id, p_actor_name);
  end loop;
  return jsonb_build_object('id', v_bkb_id, 'docNo', p->>'docNo');
end; $$;

-- ---------- 7) FUNGSI MASTER BARANG ----------
create or replace function public.create_item_master(p jsonb, p_actor_id bigint, p_actor_name text)
returns public.items language plpgsql security definer set search_path = public as $$
declare
  v_cat  text := p->>'categoryCode';
  v_qty  numeric := coalesce((p->>'quantity')::numeric, 0);
  v_item public.items;
begin
  insert into public.items (category_code, location_code, item_code, barcode, name, quantity, unit)
  values (v_cat, case when v_cat='1' then '100' else '800' end,
          trim(p->>'itemCode'),
          nullif(trim(coalesce(p->>'barcode','')), ''),
          trim(p->>'name'), v_qty,
          coalesce(nullif(trim(p->>'unit'),''),'pcs'))
  returning * into v_item;
  if v_qty > 0 then
    insert into public.transactions_log
      (jenis, keterangan, item_id, item_code, item_name, qty, direction,
       balance_before, balance_after, actor_id, actor_name)
    values ('SA','Saldo awal master barang', v_item.id, v_item.item_code, v_item.name,
            v_qty, 'in', 0, v_qty, p_actor_id, p_actor_name);
  end if;
  return v_item;
end; $$;

create or replace function public.update_item_master(p_id bigint, p jsonb, p_actor_id bigint, p_actor_name text)
returns public.items language plpgsql security definer set search_path = public as $$
declare
  v_old  public.items;
  v_cat  text := p->>'categoryCode';
  v_qty  numeric := (p->>'quantity')::numeric;
  v_item public.items;
begin
  select * into v_old from public.items where id = p_id for update;
  if not found then return null; end if;
  update public.items set
    category_code = v_cat,
    location_code = case when v_cat='1' then '100' else '800' end,
    item_code     = trim(p->>'itemCode'),
    barcode       = nullif(trim(coalesce(p->>'barcode','')), ''),
    name          = trim(p->>'name'),
    unit          = coalesce(nullif(trim(p->>'unit'),''),'pcs'),
    quantity      = v_qty,
    updated_at    = now()
  where id = p_id returning * into v_item;
  if v_qty <> v_old.quantity then
    insert into public.transactions_log
      (jenis, keterangan, item_id, item_code, item_name, qty, direction,
       balance_before, balance_after, actor_id, actor_name)
    values ('ADJ','Koreksi saldo master barang', v_item.id, v_item.item_code, v_item.name,
            abs(v_qty - v_old.quantity),
            case when v_qty > v_old.quantity then 'in' else 'out' end,
            v_old.quantity, v_qty, p_actor_id, p_actor_name);
  end if;
  return v_item;
end; $$;

revoke all on function public.create_bkb(jsonb,bigint,text)               from public,anon,authenticated;
revoke all on function public.create_item_master(jsonb,bigint,text)        from public,anon,authenticated;
revoke all on function public.update_item_master(bigint,jsonb,bigint,text) from public,anon,authenticated;
grant execute on function public.create_bkb(jsonb,bigint,text)               to service_role;
grant execute on function public.create_item_master(jsonb,bigint,text)        to service_role;
grant execute on function public.update_item_master(bigint,jsonb,bigint,text) to service_role;

-- ---------- 8) ROW LEVEL SECURITY ----------
alter table public.users            enable row level security;
alter table public.items            enable row level security;
alter table public.bkb              enable row level security;
alter table public.bkb_items        enable row level security;
alter table public.transactions_log enable row level security;
do $$ declare t text;
begin foreach t in array array['users','items','bkb','bkb_items','transactions_log'] loop
  execute format('drop policy if exists "deny_all_%1$s" on public.%1$I', t);
  execute format('create policy "deny_all_%1$s" on public.%1$I for all using (false) with check (false)', t);
end loop; end $$;

-- ---------- 9) REALTIME BROADCAST TRIGGER ----------
create or replace function public.notify_stok_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform realtime.send(jsonb_build_object('table', tg_table_name), 'changed', 'stok-hub', false);
  exception when others then null;
  end;
  return null;
end; $$;
drop trigger if exists trg_notify_items on public.items;
create trigger trg_notify_items after insert or update or delete on public.items
  for each statement execute function public.notify_stok_changed();
drop trigger if exists trg_notify_bkb on public.bkb;
create trigger trg_notify_bkb after insert or update or delete on public.bkb
  for each statement execute function public.notify_stok_changed();
drop trigger if exists trg_notify_txlog on public.transactions_log;
create trigger trg_notify_txlog after insert or update or delete on public.transactions_log
  for each statement execute function public.notify_stok_changed();
