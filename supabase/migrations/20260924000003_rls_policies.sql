-- =============================================================================
-- Row Level Security
--  * Khách (anon): đọc danh mục + mô phỏng đã publish, xem bộ sưu tập công khai.
--  * Người dùng đăng nhập: quản lý yêu thích, lịch sử của chính mình.
--  * Giáo viên: tạo/sửa bộ sưu tập của mình.
--  * Admin: toàn quyền quản trị dữ liệu.
-- =============================================================================

alter table public.subjects enable row level security;
alter table public.grades enable row level security;
alter table public.sources enable row level security;
alter table public.profiles enable row level security;
alter table public.simulations enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
alter table public.favorites enable row level security;
alter table public.user_activity enable row level security;
alter table public.issue_reports enable row level security;
alter table public.import_jobs enable row level security;
alter table public.search_synonyms enable row level security;
alter table public.simulation_daily_stats enable row level security;
alter table public.search_query_stats enable row level security;
alter table public.collection_daily_stats enable row level security;
alter table public.collection_simulation_stats enable row level security;

-- ---- Danh mục ----
drop policy if exists "subjects readable" on public.subjects;
create policy "subjects readable" on public.subjects for select using (true);
drop policy if exists "subjects admin write" on public.subjects;
create policy "subjects admin write" on public.subjects for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "grades readable" on public.grades;
create policy "grades readable" on public.grades for select using (true);
drop policy if exists "grades admin write" on public.grades;
create policy "grades admin write" on public.grades for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "sources readable" on public.sources;
create policy "sources readable" on public.sources for select using (is_active or (select public.is_admin()));
drop policy if exists "sources admin write" on public.sources;
create policy "sources admin write" on public.sources for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "synonyms readable" on public.search_synonyms;
create policy "synonyms readable" on public.search_synonyms for select using (true);
drop policy if exists "synonyms admin write" on public.search_synonyms;
create policy "synonyms admin write" on public.search_synonyms for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---- Hồ sơ ----
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_admin())) with check (id = (select auth.uid()) or (select public.is_admin()));

-- ---- Mô phỏng ----
drop policy if exists "simulations public read" on public.simulations;
create policy "simulations public read" on public.simulations for select
  using ((is_active and status = 'published') or (select public.is_admin()));
drop policy if exists "simulations admin insert" on public.simulations;
create policy "simulations admin insert" on public.simulations for insert to authenticated
  with check ((select public.is_admin()));
drop policy if exists "simulations admin update" on public.simulations;
create policy "simulations admin update" on public.simulations for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists "simulations admin delete" on public.simulations;
create policy "simulations admin delete" on public.simulations for delete to authenticated
  using ((select public.is_admin()));

-- ---- Bộ sưu tập ----
drop policy if exists "collections read" on public.collections;
create policy "collections read" on public.collections for select
  using (is_public or owner_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "collections teacher insert" on public.collections;
create policy "collections teacher insert" on public.collections for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.is_teacher()));
drop policy if exists "collections owner update" on public.collections;
create policy "collections owner update" on public.collections for update to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin())) with check (owner_id = (select auth.uid()) or (select public.is_admin()));
drop policy if exists "collections owner delete" on public.collections;
create policy "collections owner delete" on public.collections for delete to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "collection items read" on public.collection_items;
create policy "collection items read" on public.collection_items for select
  using (exists (select 1 from public.collections c where c.id = collection_id
                 and (c.is_public or c.owner_id = (select auth.uid()) or (select public.is_admin()))));
drop policy if exists "collection items owner write" on public.collection_items;
create policy "collection items owner write" on public.collection_items for all to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid())));

-- ---- Yêu thích & lịch sử (chỉ của chính mình) ----
drop policy if exists "favorites own" on public.favorites;
create policy "favorites own" on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "activity own read" on public.user_activity;
create policy "activity own read" on public.user_activity for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "activity own delete" on public.user_activity;
create policy "activity own delete" on public.user_activity for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---- Báo lỗi: ai cũng gửi được, chỉ admin đọc/xử lý ----
drop policy if exists "reports insert" on public.issue_reports;
create policy "reports insert" on public.issue_reports for insert
  with check (reporter_id is null or reporter_id = (select auth.uid()));
drop policy if exists "reports admin" on public.issue_reports;
create policy "reports admin" on public.issue_reports for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---- Import jobs ----
drop policy if exists "import jobs admin" on public.import_jobs;
create policy "import jobs admin" on public.import_jobs for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---- Thống kê: chỉ admin đọc trực tiếp; ghi qua hàm SECURITY DEFINER ----
drop policy if exists "sim stats admin" on public.simulation_daily_stats;
create policy "sim stats admin" on public.simulation_daily_stats for select to authenticated using ((select public.is_admin()));
drop policy if exists "search stats admin" on public.search_query_stats;
create policy "search stats admin" on public.search_query_stats for select to authenticated using ((select public.is_admin()));
drop policy if exists "collection stats owner" on public.collection_daily_stats;
create policy "collection stats owner" on public.collection_daily_stats for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid())));
drop policy if exists "collection sim stats owner" on public.collection_simulation_stats;
create policy "collection sim stats owner" on public.collection_simulation_stats for select to authenticated
  using ((select public.is_admin()) or exists (select 1 from public.collections c where c.id = collection_id and c.owner_id = (select auth.uid())));

-- ---- Quyền thực thi hàm ----
revoke execute on function public.import_simulations(jsonb, text, uuid) from public, anon;
revoke execute on function public.admin_dashboard_stats() from public, anon;
revoke execute on function public.admin_find_duplicates(int) from public, anon;
revoke execute on function public.existing_url_keys(text[]) from public, anon;
revoke execute on function public.teacher_collection_activity(int) from public, anon;
grant execute on function public.import_simulations(jsonb, text, uuid) to authenticated;
grant execute on function public.admin_dashboard_stats() to authenticated;
grant execute on function public.admin_find_duplicates(int) to authenticated;
grant execute on function public.existing_url_keys(text[]) to authenticated;
grant execute on function public.teacher_collection_activity(int) to authenticated;

grant execute on function public.search_simulations(text, text[], text[], int[], text[], text[], text[], text[], text[], boolean, boolean, text, int, int, text, uuid, boolean, boolean, boolean) to anon, authenticated;
grant execute on function public.popular_query_suggestions(text, int) to anon, authenticated;
grant execute on function public.catalog_counts() to anon, authenticated;
grant execute on function public.track_simulation_event(uuid, text, uuid) to anon, authenticated;
grant execute on function public.track_collection_view(uuid) to anon, authenticated;
grant execute on function public.log_search_query(text, int) to anon, authenticated;
