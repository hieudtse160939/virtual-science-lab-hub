-- =============================================================================
-- Virtual Science Lab Hub – Core schema
-- Thiết kế cho 100k → 1M bản ghi metadata. Chỉ lưu metadata + liên kết tới nguồn,
-- KHÔNG lưu nội dung mô phỏng của bên thứ ba.
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Kiểu dữ liệu
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('student', 'teacher', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.simulation_type as enum ('virtual_lab', 'simulation', 'experiment', 'model', 'data_lab', 'game');
exception when duplicate_object then null; end $$;

do $$ begin
  -- Nhóm giấy phép dùng cho bộ lọc (license text giữ nguyên tên giấy phép gốc)
  create type public.license_category as enum ('free', 'oer', 'creative_commons', 'external_free', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.difficulty_level as enum ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.publish_status as enum ('published', 'pending_review', 'draft');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Hàm tiện ích (IMMUTABLE để dùng được trong index / generated column)
-- ---------------------------------------------------------------------------
create or replace function public.f_unaccent(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

-- Chuẩn hoá chuỗi cho tìm kiếm: bỏ dấu tiếng Việt, chữ thường, gộp khoảng trắng.
-- Lưu ý: unaccent không đổi "đ" → "d" trong mọi bản; xử lý thủ công.
create or replace function public.normalize_search_text(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select btrim(regexp_replace(
    translate(lower(public.f_unaccent($1)), 'đ', 'd'),
    '\s+', ' ', 'g'))
$$;

-- Chuẩn hoá URL để phát hiện trùng lặp: bỏ giao thức, "www.", fragment, dấu "/" cuối.
create or replace function public.normalize_url(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select rtrim(
    regexp_replace(
      regexp_replace(lower(btrim($1)), '^[a-z]+://(www\.)?', ''),
      '#.*$', ''),
    '/')
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Danh mục: môn học, khối lớp, nguồn
-- ---------------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_vi text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  icon text not null default 'flask-conical',
  color text not null default '#2563eb',
  -- Từ khoá/tên gọi khác để importer map dữ liệu thô ("Vật lý", "physics", "vat ly"...)
  aliases text[] not null default '{}',
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.grades (
  id smallint primary key check (id between 1 and 12),
  name text not null,
  name_vi text not null,
  education_level text not null check (education_level in ('primary', 'lower_secondary', 'upper_secondary')),
  age_min smallint not null,
  age_max smallint not null
);

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  website_url text,
  logo_url text,
  license text,
  license_url text,
  country text,
  -- Nhà cung cấp cho phép nhúng iframe (theo điều khoản của họ). Mặc định: KHÔNG.
  allows_embed boolean not null default false,
  is_verified boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists sources_updated_at on public.sources;
create trigger sources_updated_at before update on public.sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Người dùng
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'student',
  school text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Tạo profile khi đăng ký. Chỉ cho phép tự chọn student/teacher – admin phải được cấp bằng SQL.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := coalesce(new.raw_user_meta_data ->> 'role', 'student');
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    nullif(left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120), ''),
    case when requested = 'teacher' then 'teacher'::public.user_role else 'student'::public.user_role end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Người dùng không được tự nâng quyền của mình.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- auth.uid() rỗng = truy cập trực tiếp DB (SQL Editor / service role) → được phép.
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    -- Người dùng chỉ được tự chuyển giữa học sinh ↔ giáo viên cho chính mình.
    if not (new.id = auth.uid() and old.role in ('student', 'teacher') and new.role in ('student', 'teacher')) then
      raise exception 'Không có quyền thay đổi vai trò' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.current_role_name()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role in ('teacher', 'admin') from public.profiles where id = auth.uid()), false)
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- Mô phỏng
-- ---------------------------------------------------------------------------
create table if not exists public.simulations (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 300),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 160),
  description text check (char_length(description) <= 5000),
  short_description text check (char_length(short_description) <= 300),

  subject_id uuid references public.subjects (id) on delete set null,
  sub_subject text,

  grade_min smallint not null default 1 check (grade_min between 1 and 12),
  grade_max smallint not null default 12 check (grade_max between 1 and 12),
  education_level text[] not null default '{}',

  topic text,
  subtopic text,
  simulation_type public.simulation_type not null default 'simulation',

  source_id uuid references public.sources (id) on delete set null,
  source_url text,
  simulation_url text not null check (simulation_url ~* '^https?://'),
  embed_url text check (embed_url is null or embed_url ~* '^https://'),
  thumbnail_url text check (thumbnail_url is null or thumbnail_url ~* '^https://'),

  language text not null default 'en' check (language ~ '^[a-z]{2,3}(-[A-Za-z]{2,4})?$|^multi$'),

  license text,
  license_url text,
  license_category public.license_category not null default 'external_free',

  difficulty public.difficulty_level,
  duration_minutes smallint check (duration_minutes is null or duration_minutes between 1 and 600),

  learning_objectives text[] not null default '{}',
  required_equipment text[] not null default '{}',
  tags text[] not null default '{}',

  is_free boolean not null default true,
  is_verified boolean not null default false,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  -- Dữ liệu tổng hợp để kiểm thử hiệu năng – KHÔNG phải mô phỏng thật.
  is_demo boolean not null default false,
  status public.publish_status not null default 'published',

  view_count integer not null default 0,
  favorite_count integer not null default 0,
  external_open_count integer not null default 0,

  -- Cột dẫn xuất (do trigger duy trì)
  url_key text not null,
  title_search text not null default '',
  search_text text not null default '',
  search_vector tsvector,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint simulations_grade_range check (grade_min <= grade_max)
);

comment on column public.simulations.is_demo is 'Synthetic test data for scalability testing. Never shown as real simulations.';
comment on column public.simulations.url_key is 'normalize_url(simulation_url) – dùng để phát hiện trùng lặp';

-- Trigger chuẩn hoá: education_level, url_key, trường tìm kiếm, search_vector.
create or replace function public.simulations_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_source text;
  v_subject text;
  v_subject_vi text;
  v_tags text := array_to_string(coalesce(new.tags, '{}'), ' ');
  v_objectives text := array_to_string(coalesce(new.learning_objectives, '{}'), ' ');
begin
  new.url_key := public.normalize_url(new.simulation_url);

  new.education_level := array_remove(array[
    case when new.grade_min <= 5 then 'primary' end,
    case when new.grade_min <= 9 and new.grade_max >= 6 then 'lower_secondary' end,
    case when new.grade_max >= 10 then 'upper_secondary' end
  ], null);

  select s.name into v_source from public.sources s where s.id = new.source_id;
  select s.name, s.name_vi into v_subject, v_subject_vi from public.subjects s where s.id = new.subject_id;

  new.title_search := public.normalize_search_text(new.title);
  new.search_text := left(public.normalize_search_text(concat_ws(' ',
    new.title, new.topic, new.subtopic, new.sub_subject, v_tags, v_source, v_subject, v_subject_vi)), 2000);

  -- Kết hợp cấu hình 'english' (stemming: forces → force) và 'simple' (giữ nguyên từ tiếng Việt đã bỏ dấu).
  new.search_vector :=
      setweight(to_tsvector('english', new.title_search), 'A')
   || setweight(to_tsvector('simple', new.title_search), 'A')
   || setweight(to_tsvector('simple', public.normalize_search_text(concat_ws(' ', new.topic, new.subtopic, v_tags))), 'B')
   || setweight(to_tsvector('english', public.normalize_search_text(concat_ws(' ', new.topic, new.subtopic, v_tags))), 'B')
   || setweight(to_tsvector('simple', public.normalize_search_text(concat_ws(' ', v_subject, v_subject_vi, new.sub_subject, v_source))), 'C')
   || setweight(to_tsvector('english', public.normalize_search_text(left(coalesce(new.description, '') || ' ' || coalesce(new.short_description, ''), 4000))), 'C')
   || setweight(to_tsvector('simple', public.normalize_search_text(left(coalesce(new.description, '') || ' ' || coalesce(new.short_description, ''), 4000))), 'D')
   || setweight(to_tsvector('simple', public.normalize_search_text(v_objectives)), 'D');

  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists simulations_normalize on public.simulations;
create trigger simulations_normalize before insert or update of
  title, description, short_description, subject_id, sub_subject, grade_min, grade_max, topic, subtopic,
  source_id, simulation_url, tags, learning_objectives, embed_url, thumbnail_url, language, license,
  license_url, license_category, difficulty, duration_minutes, required_equipment, simulation_type,
  is_free, is_verified, is_featured, is_active, status, source_url, slug
  on public.simulations
  for each row execute function public.simulations_before_write();

-- Khi đổi tên nguồn/môn học: cập nhật lại trường tìm kiếm của các mô phỏng liên quan.
create or replace function public.refresh_simulation_search_for_source()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    update public.simulations set source_id = source_id where source_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sources_refresh_search on public.sources;
create trigger sources_refresh_search after update of name on public.sources
  for each row execute function public.refresh_simulation_search_for_source();

create or replace function public.refresh_simulation_search_for_subject()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.name is distinct from old.name or new.name_vi is distinct from old.name_vi then
    update public.simulations set subject_id = subject_id where subject_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists subjects_refresh_search on public.subjects;
create trigger subjects_refresh_search after update of name, name_vi on public.subjects
  for each row execute function public.refresh_simulation_search_for_subject();

-- ---------------------------------------------------------------------------
-- Index (tất cả index lọc là partial index trên tập "đang hiển thị")
-- ---------------------------------------------------------------------------
create unique index if not exists simulations_url_key_idx on public.simulations (url_key);
create index if not exists simulations_search_vector_idx on public.simulations using gin (search_vector);
create index if not exists simulations_search_text_trgm_idx on public.simulations using gin (search_text extensions.gin_trgm_ops);
create index if not exists simulations_title_trgm_idx on public.simulations using gin (title_search extensions.gin_trgm_ops);
create index if not exists simulations_tags_idx on public.simulations using gin (tags);
-- Tìm theo URL trong trang quản trị
create index if not exists simulations_url_key_trgm_idx on public.simulations using gin (url_key extensions.gin_trgm_ops);

create index if not exists simulations_subject_idx on public.simulations (subject_id) where is_active and status = 'published';
create index if not exists simulations_source_idx on public.simulations (source_id);
create index if not exists simulations_grade_idx on public.simulations (grade_min, grade_max) where is_active and status = 'published';
create index if not exists simulations_language_idx on public.simulations (language) where is_active and status = 'published';
create index if not exists simulations_type_idx on public.simulations (simulation_type) where is_active and status = 'published';
create index if not exists simulations_license_idx on public.simulations (license_category) where is_active and status = 'published';
create index if not exists simulations_is_free_idx on public.simulations (is_free) where is_active and status = 'published';
create index if not exists simulations_is_verified_idx on public.simulations (is_verified) where is_active and status = 'published';
create index if not exists simulations_is_active_idx on public.simulations (is_active, status);
create index if not exists simulations_featured_idx on public.simulations (is_featured) where is_featured and is_active and status = 'published';
create index if not exists simulations_is_demo_idx on public.simulations (is_demo) where is_demo;

-- Keyset pagination cho các kiểu sắp xếp
create index if not exists simulations_newest_idx on public.simulations (created_at desc, id desc) where is_active and status = 'published';
create index if not exists simulations_popular_idx on public.simulations (view_count desc, id desc) where is_active and status = 'published';
create index if not exists simulations_title_sort_idx on public.simulations (title_search asc, id asc) where is_active and status = 'published';
create index if not exists simulations_updated_idx on public.simulations (updated_at desc);

-- ---------------------------------------------------------------------------
-- Bộ sưu tập, yêu thích, lịch sử
-- ---------------------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 150),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 2000),
  owner_id uuid not null references auth.users (id) on delete cascade,
  is_public boolean not null default false,
  item_count integer not null default 0,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collections_owner_idx on public.collections (owner_id, updated_at desc);
create index if not exists collections_public_idx on public.collections (updated_at desc) where is_public and item_count > 0;

drop trigger if exists collections_updated_at on public.collections;
create trigger collections_updated_at before update on public.collections
  for each row execute function public.set_updated_at();

create table if not exists public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  sort_order integer not null default 0,
  note text check (char_length(note) <= 1000),
  added_at timestamptz not null default now(),
  primary key (collection_id, simulation_id)
);

create index if not exists collection_items_order_idx on public.collection_items (collection_id, sort_order);
create index if not exists collection_items_simulation_idx on public.collection_items (simulation_id);

create or replace function public.collection_items_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.collections set item_count = item_count + 1, updated_at = now() where id = new.collection_id;
  elsif tg_op = 'DELETE' then
    update public.collections set item_count = greatest(item_count - 1, 0), updated_at = now() where id = old.collection_id;
  end if;
  return null;
end;
$$;

drop trigger if exists collection_items_count_trg on public.collection_items;
create trigger collection_items_count_trg after insert or delete on public.collection_items
  for each row execute function public.collection_items_count();

create table if not exists public.favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, simulation_id)
);

create index if not exists favorites_user_idx on public.favorites (user_id, created_at desc);
create index if not exists favorites_simulation_idx on public.favorites (simulation_id);

create or replace function public.favorites_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.simulations set favorite_count = favorite_count + 1 where id = new.simulation_id;
  elsif tg_op = 'DELETE' then
    update public.simulations set favorite_count = greatest(favorite_count - 1, 0) where id = old.simulation_id;
  end if;
  return null;
end;
$$;

drop trigger if exists favorites_count_trg on public.favorites;
create trigger favorites_count_trg after insert or delete on public.favorites
  for each row execute function public.favorites_count();

-- Lịch sử sử dụng gần đây của chính người dùng (phục vụ "Recently Used").
create table if not exists public.user_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  open_count integer not null default 1,
  last_opened_at timestamptz not null default now(),
  primary key (user_id, simulation_id)
);

create index if not exists user_activity_recent_idx on public.user_activity (user_id, last_opened_at desc);

-- ---------------------------------------------------------------------------
-- Báo lỗi & nhật ký import
-- ---------------------------------------------------------------------------
create table if not exists public.issue_reports (
  id uuid primary key default gen_random_uuid(),
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  reason text not null check (reason in ('broken_link', 'embed_blocked', 'wrong_info', 'inappropriate', 'other')),
  message text check (char_length(message) <= 1000),
  reporter_id uuid references auth.users (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists issue_reports_status_idx on public.issue_reports (status, created_at desc);

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  format text not null check (format in ('csv', 'json', 'jsonl')),
  on_duplicate text not null default 'skip' check (on_duplicate in ('skip', 'update')),
  total_records integer not null default 0,
  inserted integer not null default 0,
  updated integer not null default 0,
  skipped integer not null default 0,
  failed integer not null default 0,
  status text not null default 'running' check (status in ('running', 'completed', 'completed_with_errors', 'cancelled')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists import_jobs_created_idx on public.import_jobs (created_at desc);

-- Từ đồng nghĩa phục vụ tìm kiếm song ngữ ("định luật ohm" → ohm, resistance, circuit...).
create table if not exists public.search_synonyms (
  term text primary key,          -- đã chuẩn hoá bằng normalize_search_text
  expansions text[] not null      -- các từ khoá mở rộng (đã chuẩn hoá)
);
