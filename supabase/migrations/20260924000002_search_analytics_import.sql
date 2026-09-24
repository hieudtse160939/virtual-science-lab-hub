-- =============================================================================
-- Search engine, analytics, bulk import, admin statistics
-- =============================================================================

create or replace function public.slugify(text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select left(btrim(regexp_replace(public.normalize_search_text($1), '[^a-z0-9]+', '-', 'g'), '-'), 120)
$$;

-- ---------------------------------------------------------------------------
-- Analytics: chỉ lưu số liệu tổng hợp theo ngày, không lưu IP / định danh.
-- ---------------------------------------------------------------------------
create table if not exists public.simulation_daily_stats (
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  day date not null default current_date,
  views integer not null default 0,
  external_opens integer not null default 0,
  embed_opens integer not null default 0,
  primary key (simulation_id, day)
);
create index if not exists simulation_daily_stats_day_idx on public.simulation_daily_stats (day);

create table if not exists public.search_query_stats (
  query text not null,
  day date not null default current_date,
  count integer not null default 1,
  last_result_count integer not null default 0,
  primary key (query, day)
);
create index if not exists search_query_stats_day_idx on public.search_query_stats (day);
create index if not exists search_query_stats_prefix_idx on public.search_query_stats (query text_pattern_ops);

create table if not exists public.collection_daily_stats (
  collection_id uuid not null references public.collections (id) on delete cascade,
  day date not null default current_date,
  views integer not null default 0,
  simulation_opens integer not null default 0,
  primary key (collection_id, day)
);

create table if not exists public.collection_simulation_stats (
  collection_id uuid not null references public.collections (id) on delete cascade,
  simulation_id uuid not null references public.simulations (id) on delete cascade,
  opens integer not null default 0,
  last_opened_at timestamptz not null default now(),
  primary key (collection_id, simulation_id)
);

create or replace function public.track_simulation_event(
  p_simulation_id uuid,
  p_event text,
  p_collection_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event not in ('view', 'external_open', 'embed_open') then
    raise exception 'invalid event' using errcode = '22023';
  end if;

  if not exists (select 1 from public.simulations where id = p_simulation_id and is_active) then
    return;
  end if;

  update public.simulations set
    view_count = view_count + case when p_event = 'view' then 1 else 0 end,
    external_open_count = external_open_count + case when p_event = 'external_open' then 1 else 0 end
  where id = p_simulation_id;

  insert into public.simulation_daily_stats (simulation_id, day, views, external_opens, embed_opens)
  values (
    p_simulation_id, current_date,
    (p_event = 'view')::int, (p_event = 'external_open')::int, (p_event = 'embed_open')::int
  )
  on conflict (simulation_id, day) do update set
    views = public.simulation_daily_stats.views + excluded.views,
    external_opens = public.simulation_daily_stats.external_opens + excluded.external_opens,
    embed_opens = public.simulation_daily_stats.embed_opens + excluded.embed_opens;

  -- Lịch sử cá nhân chỉ khi đã đăng nhập (phục vụ "Recently Used" của chính người dùng).
  if auth.uid() is not null and p_event in ('external_open', 'embed_open') then
    insert into public.user_activity (user_id, simulation_id)
    values (auth.uid(), p_simulation_id)
    on conflict (user_id, simulation_id) do update set
      open_count = public.user_activity.open_count + 1,
      last_opened_at = now();
  end if;

  -- Thống kê ẩn danh cho giáo viên: học sinh mở mô phỏng từ link bộ sưu tập.
  if p_collection_id is not null and p_event in ('external_open', 'embed_open')
     and exists (select 1 from public.collection_items ci
                 where ci.collection_id = p_collection_id and ci.simulation_id = p_simulation_id) then
    insert into public.collection_daily_stats (collection_id, day, simulation_opens)
    values (p_collection_id, current_date, 1)
    on conflict (collection_id, day) do update set
      simulation_opens = public.collection_daily_stats.simulation_opens + 1;

    insert into public.collection_simulation_stats (collection_id, simulation_id, opens)
    values (p_collection_id, p_simulation_id, 1)
    on conflict (collection_id, simulation_id) do update set
      opens = public.collection_simulation_stats.opens + 1,
      last_opened_at = now();
  end if;
end;
$$;

create or replace function public.track_collection_view(p_collection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.collections set view_count = view_count + 1 where id = p_collection_id and is_public;
  if found then
    insert into public.collection_daily_stats (collection_id, day, views)
    values (p_collection_id, current_date, 1)
    on conflict (collection_id, day) do update set views = public.collection_daily_stats.views + 1;
  end if;
end;
$$;

create or replace function public.log_search_query(p_query text, p_result_count int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q text := left(public.normalize_search_text(coalesce(p_query, '')), 100);
begin
  if char_length(v_q) < 2 then
    return;
  end if;
  insert into public.search_query_stats (query, day, count, last_result_count)
  values (v_q, current_date, 1, greatest(coalesce(p_result_count, 0), 0))
  on conflict (query, day) do update set
    count = public.search_query_stats.count + 1,
    last_result_count = excluded.last_result_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- SEARCH ENGINE
--   * Full-text search (english stemming + simple/không dấu cho tiếng Việt)
--   * Mở rộng từ đồng nghĩa song ngữ (search_synonyms)
--   * Fuzzy / chịu lỗi chính tả bằng pg_trgm word similarity
--   * Xếp hạng tổng hợp: độ liên quan + độ tương đồng tiêu đề + featured/verified + độ phổ biến
--   * Lọc hoàn toàn phía server, keyset pagination cho sắp xếp không theo độ liên quan
-- ---------------------------------------------------------------------------
create or replace function public.build_search_queries(
  p_query text,
  p_relaxed boolean,
  out q_norm text,
  out tsq_main tsquery,
  out tsq_any tsquery,
  out tsq_syn tsquery
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_words text[];
  v_expansions text[];
  v_last int;
  v_and text;
  v_or text;
  e text;
  stop_words constant text[] := array[
    'va', 'cua', 'cac', 'nhung', 'la', 'cho', 'trong', 'voi', 'mot', 've', 'thi', 'o', 'tu', 'den',
    'of', 'and', 'an', 'to', 'in', 'on', 'for', 'with', 'is'
  ];
begin
  q_norm := nullif(public.normalize_search_text(coalesce(p_query, '')), '');
  if q_norm is null then
    return;
  end if;

  select array_agg(w order by ord) into v_words
  from unnest(regexp_split_to_array(regexp_replace(q_norm, '[^a-z0-9]+', ' ', 'g'), ' ')) with ordinality as t(w, ord)
  where w <> '' and not (w = any (stop_words));

  if v_words is not null and array_length(v_words, 1) > 0 then
    v_last := array_length(v_words, 1);
    -- Từ cuối cùng dùng tiền tố (:*) để hỗ trợ gõ dở ("circ" → circuit).
    v_and := array_to_string(v_words[1:v_last - 1], ' & ')
             || case when v_last > 1 then ' & ' else '' end
             || v_words[v_last] || case when char_length(v_words[v_last]) >= 3 then ':*' else '' end;
    v_or := array_to_string(v_words, ' | ');

    tsq_main := to_tsquery('simple', v_and) || to_tsquery('english', v_and);
    if p_relaxed then
      tsq_main := to_tsquery('simple', v_or) || to_tsquery('english', v_or);
    end if;
    tsq_any := to_tsquery('simple', v_or) || to_tsquery('english', v_or);
  end if;

  select array_agg(distinct x) into v_expansions
  from public.search_synonyms syn, unnest(syn.expansions) x
  where (' ' || array_to_string(v_words, ' ') || ' ') like ('% ' || syn.term || ' %')
     or (char_length(syn.term) >= 5 and array_to_string(v_words, ' ') like syn.term || '%');

  if v_expansions is not null then
    foreach e in array v_expansions loop
      tsq_syn := case when tsq_syn is null then phraseto_tsquery('english', e)
                      else tsq_syn || phraseto_tsquery('english', e) end;
    end loop;
  end if;
end;
$$;

create or replace function public.search_simulations(
  p_query text default null,
  p_subjects text[] default null,
  p_levels text[] default null,
  p_grades int[] default null,
  p_languages text[] default null,
  p_sources text[] default null,
  p_types text[] default null,
  p_licenses text[] default null,
  p_durations text[] default null,
  p_free_only boolean default false,
  p_verified_only boolean default false,
  p_sort text default 'relevance',
  p_limit int default 24,
  p_offset int default 0,
  p_cursor_value text default null,
  p_cursor_id uuid default null,
  p_with_total boolean default true,
  p_include_demo boolean default false,
  p_relaxed boolean default false
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
set pg_trgm.word_similarity_threshold = 0.5
set statement_timeout = '8s'
as $$
declare
  v_q text;
  v_main tsquery;
  v_any tsquery;
  v_syn tsquery;
  v_where text;
  v_match text;
  v_score text;
  v_order text;
  v_sort_key text;
  v_cursor_cond text := '';
  v_sql text;
  v_items jsonb;
  v_total bigint;
  v_limit int := least(greatest(coalesce(p_limit, 24), 1), 100);
  v_offset int := least(greatest(coalesce(p_offset, 0), 0), 5000);
  v_sort text := coalesce(p_sort, 'relevance');
  v_relaxed boolean := false;
  v_next jsonb := null;
  v_count int;
  v_last jsonb;
  v_include_demo boolean := coalesce(p_include_demo, false) and public.is_admin();
begin
  select b.q_norm, b.tsq_main, b.tsq_any, b.tsq_syn into v_q, v_main, v_any, v_syn
  from public.build_search_queries(p_query, false) b;

  if v_q is null and v_sort = 'relevance' then
    v_sort := 'popular';
  end if;
  if v_sort not in ('relevance', 'popular', 'newest', 'title', 'favorites') then
    v_sort := 'popular';
  end if;

  -- ---- Điều kiện lọc (dùng tham số $n, không nối chuỗi dữ liệu người dùng) ----
  v_where := 's.is_active and s.status = ''published''';
  if not v_include_demo then
    v_where := v_where || ' and not s.is_demo';
  end if;
  if p_subjects is not null and cardinality(p_subjects) > 0 then
    v_where := v_where || ' and s.subject_id in (select id from public.subjects where slug = any($1))';
  end if;
  if p_levels is not null and cardinality(p_levels) > 0 then
    v_where := v_where || ' and s.education_level && $2';
  end if;
  if p_grades is not null and cardinality(p_grades) > 0 then
    v_where := v_where || ' and exists (select 1 from unnest($3) g where g between s.grade_min and s.grade_max)';
  end if;
  if p_languages is not null and cardinality(p_languages) > 0 then
    v_where := v_where || ' and (s.language = any($4)'
      || case when 'other' = any (p_languages) then ' or s.language not in (''vi'', ''en'', ''multi'')' else '' end || ')';
  end if;
  if p_sources is not null and cardinality(p_sources) > 0 then
    v_where := v_where || ' and (s.source_id in (select id from public.sources where slug = any($5))'
      || case when 'other' = any (p_sources)
           then ' or s.source_id is null or s.source_id in (select id from public.sources where not is_verified)'
           else '' end || ')';
  end if;
  if p_types is not null and cardinality(p_types) > 0 then
    v_where := v_where || ' and s.simulation_type::text = any($6)';
  end if;
  if p_licenses is not null and cardinality(p_licenses) > 0 then
    v_where := v_where || ' and s.license_category::text = any($7)';
  end if;
  if p_durations is not null and cardinality(p_durations) > 0 then
    v_where := v_where || ' and (false'
      || case when 'lte5' = any (p_durations) then ' or s.duration_minutes <= 5' else '' end
      || case when 'lte10' = any (p_durations) then ' or s.duration_minutes between 6 and 10' else '' end
      || case when 'lte15' = any (p_durations) then ' or s.duration_minutes between 11 and 15' else '' end
      || case when 'lte30' = any (p_durations) then ' or s.duration_minutes between 16 and 30' else '' end
      || case when 'gt30' = any (p_durations) then ' or s.duration_minutes > 30' else '' end
      || ')';
  end if;
  if coalesce(p_free_only, false) then
    v_where := v_where || ' and s.is_free';
  end if;
  if coalesce(p_verified_only, false) then
    v_where := v_where || ' and s.is_verified';
  end if;

  -- ---- Điều kiện khớp từ khoá ----
  -- Bước 1: FTS (AND, từ cuối dạng tiền tố) + từ đồng nghĩa — dùng GIN index, rất nhanh.
  -- Bước 2 (chỉ khi bước 1 rỗng): nới lỏng thành OR + so khớp mờ trigram trên tiêu đề (lỗi chính tả).
  v_relaxed := coalesce(p_relaxed, false) and v_q is not null;
  if v_relaxed then
    v_main := v_any;
  end if;
  if v_q is not null then
    v_score := '(coalesce(ts_rank_cd(s.search_vector, $9, 32), 0) * 4'
      || ' + coalesce(ts_rank(s.search_vector, $10), 0)'
      || case when v_syn is not null then ' + coalesce(ts_rank(s.search_vector, $11), 0) * 6' else '' end
      || ' + extensions.similarity(s.title_search, $8) * 2'
      || ' + extensions.word_similarity($8, s.title_search)'
      || ' + case when s.title_search = $8 then 3 when s.title_search like ($8 || ''%'') then 1 else 0 end'
      || ' + s.is_featured::int * 0.15 + s.is_verified::int * 0.1 + ln(1 + s.view_count) * 0.02)';
  else
    v_match := 'true';
    v_score := '0';
  end if;

  -- ---- Sắp xếp & keyset pagination ----
  case v_sort
    when 'relevance' then
      v_order := '_score desc, s.view_count desc, s.id desc';
      v_sort_key := 'null';
    when 'newest' then
      v_order := 's.created_at desc, s.id desc';
      v_sort_key := 's.created_at::text';
      if p_cursor_id is not null and p_cursor_value is not null then
        v_cursor_cond := ' and (s.created_at, s.id) < ($12::timestamptz, $13)';
      end if;
    when 'title' then
      v_order := 's.title_search asc, s.id asc';
      v_sort_key := 's.title_search';
      if p_cursor_id is not null and p_cursor_value is not null then
        v_cursor_cond := ' and (s.title_search, s.id) > ($12, $13)';
      end if;
    when 'favorites' then
      v_order := 's.favorite_count desc, s.id desc';
      v_sort_key := 's.favorite_count::text';
      if p_cursor_id is not null and p_cursor_value is not null then
        v_cursor_cond := ' and (s.favorite_count, s.id) < ($12::int, $13)';
      end if;
    else
      v_order := 's.view_count desc, s.id desc';
      v_sort_key := 's.view_count::text';
      if p_cursor_id is not null and p_cursor_value is not null then
        v_cursor_cond := ' and (s.view_count, s.id) < ($12::int, $13)';
      end if;
  end case;

  for attempt in 1..2 loop
    if v_q is not null then
      v_match := '(s.search_vector @@ $9'
        || case when v_syn is not null then ' or s.search_vector @@ $11' else '' end
        || case when v_relaxed then ' or $8 operator(extensions.<%) s.title_search' else '' end
        || ')';
    end if;
    v_sql := format($f$
      select coalesce(jsonb_agg(to_jsonb(r) - '_ord' order by r._ord), '[]'::jsonb)
      from (
        select
          row_number() over (order by %s) as _ord,
          s.id, s.slug, s.title, s.short_description,
          s.grade_min, s.grade_max, s.education_level, s.language, s.simulation_type,
          s.license_category, s.difficulty, s.duration_minutes,
          s.is_free, s.is_verified, s.is_featured, s.is_demo,
          s.thumbnail_url, s.simulation_url, s.embed_url,
          s.view_count, s.favorite_count, s.created_at,
          case when sub.id is null then null else jsonb_build_object(
            'slug', sub.slug, 'name', sub.name, 'name_vi', sub.name_vi, 'icon', sub.icon, 'color', sub.color) end as subject,
          case when src.id is null then null else jsonb_build_object(
            'slug', src.slug, 'name', src.name, 'allows_embed', src.allows_embed) end as source,
          %s as _sort_value,
          round((%s)::numeric, 4) as _score
        from (
          select s.*, %s as _score_inner
          from public.simulations s
          where %s and %s %s
          order by %s
          offset %s limit %s
        ) s
        left join public.subjects sub on sub.id = s.subject_id
        left join public.sources src on src.id = s.source_id
      ) r
    $f$,
      replace(v_order, '_score', 's._score_inner'),
      v_sort_key, 's._score_inner', v_score, v_where, v_match, v_cursor_cond,
      replace(v_order, '_score', '_score_inner'),
      case when v_sort = 'relevance' then v_offset else 0 end, v_limit + 1);

    execute v_sql into v_items
      using p_subjects, p_levels, p_grades, p_languages, p_sources, p_types, p_licenses,
            v_q, v_main, v_any, v_syn, p_cursor_value, p_cursor_id;

    -- Không có kết quả với truy vấn AND → nới lỏng thành OR (một lần).
    exit when jsonb_array_length(v_items) > 0 or v_q is null or v_relaxed or v_offset > 0 or p_cursor_id is not null;
    v_relaxed := true;
    v_main := v_any;
  end loop;

  v_count := jsonb_array_length(v_items);
  if v_count > v_limit then
    v_items := v_items - v_limit;  -- bỏ phần tử dư (dùng để biết còn trang sau)
    v_last := v_items -> (v_limit - 1);
    if v_sort = 'relevance' then
      v_next := jsonb_build_object('offset', v_offset + v_limit, 'relaxed', v_relaxed);
    else
      v_next := jsonb_build_object('value', v_last ->> '_sort_value', 'id', v_last ->> 'id');
    end if;
  end if;

  if coalesce(p_with_total, true) then
    execute format('select count(*) from (select 1 from public.simulations s where %s and %s limit 10001) t',
                   v_where, v_match)
      into v_total
      using p_subjects, p_levels, p_grades, p_languages, p_sources, p_types, p_licenses,
            v_q, v_main, v_any, v_syn;
  end if;

  return jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'total_capped', coalesce(v_total > 10000, false),
    'next', v_next,
    'relaxed', v_relaxed,
    'sort', v_sort
  );
end;
$$;

-- Gợi ý tìm kiếm phổ biến (autocomplete cấp truy vấn), không chứa dữ liệu cá nhân.
create or replace function public.popular_query_suggestions(p_prefix text, p_limit int default 5)
returns table (query text, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select q.query, sum(q.count) as total
  from public.search_query_stats q
  where q.day > current_date - 90
    and q.last_result_count > 0
    and q.query like (public.normalize_search_text(p_prefix) || '%')
    and char_length(public.normalize_search_text(p_prefix)) >= 2
  group by q.query
  having sum(q.count) >= 2
  order by total desc
  limit least(greatest(p_limit, 1), 10)
$$;

-- Số lượng theo môn / nguồn cho trang chủ & sidebar (không tính dữ liệu demo).
create or replace function public.catalog_counts()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.simulations where is_active and status = 'published' and not is_demo),
    'subjects', coalesce((
      select jsonb_object_agg(sub.slug, c.n)
      from (select subject_id, count(*) n from public.simulations
            where is_active and status = 'published' and not is_demo and subject_id is not null
            group by subject_id) c
      join public.subjects sub on sub.id = c.subject_id), '{}'::jsonb),
    'sources', coalesce((
      select jsonb_object_agg(src.slug, c.n)
      from (select source_id, count(*) n from public.simulations
            where is_active and status = 'published' and not is_demo and source_id is not null
            group by source_id) c
      join public.sources src on src.id = c.source_id), '{}'::jsonb)
  )
$$;

-- ---------------------------------------------------------------------------
-- BULK IMPORT – một lời gọi xử lý cả lô (mặc định 500 bản ghi), không insert từng request.
-- Dữ liệu đã được validate/normalize ở server (TypeScript); hàm này map nguồn/môn,
-- tạo slug duy nhất, phát hiện trùng lặp theo url_key và ghi lỗi theo từng dòng.
-- ---------------------------------------------------------------------------
create or replace function public.import_simulations(
  p_rows jsonb,
  p_on_duplicate text default 'skip',
  p_job_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '55s'
as $$
declare
  v_inserted int := 0;
  v_updated int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
  rec record;
  v_bulk_ok boolean := true;
  v_n int;
begin
  if not public.is_admin() then
    raise exception 'Chỉ admin được import dữ liệu' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows phải là mảng JSON' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Tối đa 2000 bản ghi mỗi lô' using errcode = '22023';
  end if;

  -- 1) Tạo nguồn mới (chưa xác minh) cho các source_name chưa có.
  insert into public.sources (name, slug, is_verified, is_active)
  select distinct on (public.slugify(t.name)) t.name, public.slugify(t.name), false, true
  from (
    select btrim(x ->> 'source_name') as name from jsonb_array_elements(p_rows) x
  ) t
  where coalesce(t.name, '') <> '' and public.slugify(t.name) <> ''
    and not exists (select 1 from public.sources s where lower(s.name) = lower(t.name) or s.slug = public.slugify(t.name))
  on conflict do nothing;

  -- 2) Bảng tạm đã map khoá ngoại + url_key + slug gốc
  create temp table _imp on commit drop as
  select
    (t.ord - 1)::int as idx,
    t.x,
    public.normalize_url(t.x ->> 'simulation_url') as url_key,
    coalesce(nullif(public.slugify(coalesce(nullif(t.x ->> 'slug', ''), t.x ->> 'title')), ''), 'simulation') as base_slug,
    (select id from public.subjects sub where sub.slug = t.x ->> 'subject') as subject_id,
    (select id from public.sources src
      where lower(src.name) = lower(btrim(t.x ->> 'source_name')) or src.slug = public.slugify(btrim(t.x ->> 'source_name'))
      order by (lower(src.name) = lower(btrim(t.x ->> 'source_name'))) desc limit 1) as source_id,
    null::uuid as existing_id,
    null::text as final_slug,
    false as batch_dup
  from jsonb_array_elements(p_rows) with ordinality as t(x, ord);

  update _imp i set existing_id = s.id from public.simulations s where s.url_key = i.url_key;

  update _imp i set batch_dup = true
  where exists (select 1 from _imp j where j.url_key = i.url_key and j.idx < i.idx);

  -- Slug duy nhất: nếu trùng với bản ghi khác (hoặc trong lô) → thêm hậu tố hash từ URL.
  update _imp i set final_slug = case
    when exists (select 1 from public.simulations s where s.slug = i.base_slug and s.url_key <> i.url_key)
      or exists (select 1 from _imp j where j.base_slug = i.base_slug and j.idx < i.idx and not j.batch_dup)
    then left(i.base_slug, 110) || '-' || substr(md5(i.url_key), 1, 6)
    else i.base_slug end;

  select count(*) into v_n from _imp where batch_dup;
  v_skipped := v_skipped + v_n;
  if p_on_duplicate <> 'update' then
    select count(*) into v_n from _imp where existing_id is not null and not batch_dup;
    v_skipped := v_skipped + v_n;
  end if;

  -- 3) Chèn hàng loạt; nếu lỗi → xử lý từng dòng để báo lỗi chính xác.
  begin
    insert into public.simulations (
      title, slug, description, short_description, subject_id, sub_subject, grade_min, grade_max,
      topic, subtopic, simulation_type, source_id, source_url, simulation_url, embed_url, thumbnail_url,
      language, license, license_url, license_category, difficulty, duration_minutes,
      learning_objectives, required_equipment, tags, is_free, is_verified, is_featured, is_demo, status, created_by
    )
    select
      i.x ->> 'title', i.final_slug, i.x ->> 'description', i.x ->> 'short_description', i.subject_id,
      i.x ->> 'sub_subject', (i.x ->> 'grade_min')::smallint, (i.x ->> 'grade_max')::smallint,
      i.x ->> 'topic', i.x ->> 'subtopic', coalesce((i.x ->> 'simulation_type')::public.simulation_type, 'simulation'),
      i.source_id, i.x ->> 'source_url', i.x ->> 'simulation_url', i.x ->> 'embed_url', i.x ->> 'thumbnail_url',
      coalesce(i.x ->> 'language', 'en'), i.x ->> 'license', i.x ->> 'license_url',
      coalesce((i.x ->> 'license_category')::public.license_category, 'external_free'),
      (i.x ->> 'difficulty')::public.difficulty_level, (i.x ->> 'duration_minutes')::smallint,
      coalesce(array(select jsonb_array_elements_text(i.x -> 'learning_objectives')), '{}'),
      coalesce(array(select jsonb_array_elements_text(i.x -> 'required_equipment')), '{}'),
      coalesce(array(select jsonb_array_elements_text(i.x -> 'tags')), '{}'),
      coalesce((i.x ->> 'is_free')::boolean, true), coalesce((i.x ->> 'is_verified')::boolean, false),
      coalesce((i.x ->> 'is_featured')::boolean, false), coalesce((i.x ->> 'is_demo')::boolean, false),
      coalesce((i.x ->> 'status')::public.publish_status, 'published'), auth.uid()
    from _imp i
    where i.existing_id is null and not i.batch_dup
    on conflict (url_key) do nothing;
    get diagnostics v_inserted = row_count;
  exception when others then
    v_bulk_ok := false;
  end;

  if not v_bulk_ok then
    v_inserted := 0;
    for rec in select * from _imp where existing_id is null and not batch_dup order by idx loop
      begin
        insert into public.simulations (
          title, slug, description, short_description, subject_id, sub_subject, grade_min, grade_max,
          topic, subtopic, simulation_type, source_id, source_url, simulation_url, embed_url, thumbnail_url,
          language, license, license_url, license_category, difficulty, duration_minutes,
          learning_objectives, required_equipment, tags, is_free, is_verified, is_featured, is_demo, status, created_by
        ) values (
          rec.x ->> 'title', rec.final_slug, rec.x ->> 'description', rec.x ->> 'short_description', rec.subject_id,
          rec.x ->> 'sub_subject', (rec.x ->> 'grade_min')::smallint, (rec.x ->> 'grade_max')::smallint,
          rec.x ->> 'topic', rec.x ->> 'subtopic', coalesce((rec.x ->> 'simulation_type')::public.simulation_type, 'simulation'),
          rec.source_id, rec.x ->> 'source_url', rec.x ->> 'simulation_url', rec.x ->> 'embed_url', rec.x ->> 'thumbnail_url',
          coalesce(rec.x ->> 'language', 'en'), rec.x ->> 'license', rec.x ->> 'license_url',
          coalesce((rec.x ->> 'license_category')::public.license_category, 'external_free'),
          (rec.x ->> 'difficulty')::public.difficulty_level, (rec.x ->> 'duration_minutes')::smallint,
          coalesce(array(select jsonb_array_elements_text(rec.x -> 'learning_objectives')), '{}'),
          coalesce(array(select jsonb_array_elements_text(rec.x -> 'required_equipment')), '{}'),
          coalesce(array(select jsonb_array_elements_text(rec.x -> 'tags')), '{}'),
          coalesce((rec.x ->> 'is_free')::boolean, true), coalesce((rec.x ->> 'is_verified')::boolean, false),
          coalesce((rec.x ->> 'is_featured')::boolean, false), coalesce((rec.x ->> 'is_demo')::boolean, false),
          coalesce((rec.x ->> 'status')::public.publish_status, 'published'), auth.uid()
        )
        on conflict (url_key) do nothing;
        if found then
          v_inserted := v_inserted + 1;
        else
          v_skipped := v_skipped + 1;
        end if;
      exception when others then
        v_errors := v_errors || jsonb_build_object('index', rec.idx, 'message', sqlerrm);
      end;
    end loop;
  end if;

  -- 4) Cập nhật bản ghi trùng (nếu admin chọn "update")
  if p_on_duplicate = 'update' then
    for rec in select * from _imp where existing_id is not null and not batch_dup order by idx loop
      begin
        update public.simulations s set
          title = rec.x ->> 'title',
          description = coalesce(rec.x ->> 'description', s.description),
          short_description = coalesce(rec.x ->> 'short_description', s.short_description),
          subject_id = coalesce(rec.subject_id, s.subject_id),
          sub_subject = coalesce(rec.x ->> 'sub_subject', s.sub_subject),
          grade_min = (rec.x ->> 'grade_min')::smallint,
          grade_max = (rec.x ->> 'grade_max')::smallint,
          topic = coalesce(rec.x ->> 'topic', s.topic),
          subtopic = coalesce(rec.x ->> 'subtopic', s.subtopic),
          simulation_type = coalesce((rec.x ->> 'simulation_type')::public.simulation_type, s.simulation_type),
          source_id = coalesce(rec.source_id, s.source_id),
          source_url = coalesce(rec.x ->> 'source_url', s.source_url),
          embed_url = coalesce(rec.x ->> 'embed_url', s.embed_url),
          thumbnail_url = coalesce(rec.x ->> 'thumbnail_url', s.thumbnail_url),
          language = coalesce(rec.x ->> 'language', s.language),
          license = coalesce(rec.x ->> 'license', s.license),
          license_url = coalesce(rec.x ->> 'license_url', s.license_url),
          license_category = coalesce((rec.x ->> 'license_category')::public.license_category, s.license_category),
          difficulty = coalesce((rec.x ->> 'difficulty')::public.difficulty_level, s.difficulty),
          duration_minutes = coalesce((rec.x ->> 'duration_minutes')::smallint, s.duration_minutes),
          learning_objectives = case when jsonb_array_length(coalesce(rec.x -> 'learning_objectives', '[]')) > 0
            then array(select jsonb_array_elements_text(rec.x -> 'learning_objectives')) else s.learning_objectives end,
          required_equipment = case when jsonb_array_length(coalesce(rec.x -> 'required_equipment', '[]')) > 0
            then array(select jsonb_array_elements_text(rec.x -> 'required_equipment')) else s.required_equipment end,
          tags = case when jsonb_array_length(coalesce(rec.x -> 'tags', '[]')) > 0
            then array(select jsonb_array_elements_text(rec.x -> 'tags')) else s.tags end,
          is_free = coalesce((rec.x ->> 'is_free')::boolean, s.is_free)
        where s.id = rec.existing_id;
        v_updated := v_updated + 1;
      exception when others then
        v_errors := v_errors || jsonb_build_object('index', rec.idx, 'message', sqlerrm);
      end;
    end loop;
  end if;

  if p_job_id is not null then
    update public.import_jobs set
      inserted = inserted + v_inserted,
      updated = updated + v_updated,
      skipped = skipped + v_skipped,
      failed = failed + jsonb_array_length(v_errors)
    where id = p_job_id;
  end if;

  return jsonb_build_object(
    'inserted', v_inserted, 'updated', v_updated, 'skipped', v_skipped, 'errors', v_errors
  );
end;
$$;

-- Kiểm tra trước khi import: URL nào đã tồn tại (dùng cho màn hình xem trước).
create or replace function public.existing_url_keys(p_keys text[])
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select s.url_key from public.simulations s
  where public.is_admin() and s.url_key = any (p_keys[1:5000])
$$;

-- ---------------------------------------------------------------------------
-- ADMIN
-- ---------------------------------------------------------------------------
create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '20s'
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'totals', (select jsonb_build_object(
        'simulations', count(*),
        'active', count(*) filter (where is_active and status = 'published'),
        'pending_review', count(*) filter (where status = 'pending_review'),
        'inactive', count(*) filter (where not is_active),
        'demo', count(*) filter (where is_demo),
        'verified', count(*) filter (where is_verified),
        'views', coalesce(sum(view_count), 0),
        'external_opens', coalesce(sum(external_open_count), 0),
        'favorites', coalesce(sum(favorite_count), 0))
      from public.simulations),
    'sources', (select count(*) from public.sources),
    'subjects', (select count(*) from public.subjects),
    'users', (select jsonb_build_object(
        'total', count(*),
        'teachers', count(*) filter (where role = 'teacher'),
        'students', count(*) filter (where role = 'student'),
        'admins', count(*) filter (where role = 'admin'))
      from public.profiles),
    'collections', (select count(*) from public.collections),
    'open_reports', (select count(*) from public.issue_reports where status = 'open'),
    'by_subject', coalesce((
      select jsonb_agg(jsonb_build_object('key', coalesce(sub.slug, 'none'), 'label', coalesce(sub.name_vi, '—'),
                                          'label_en', coalesce(sub.name, '—'), 'value', c.n) order by c.n desc)
      from (select subject_id, count(*) n from public.simulations where is_active group by subject_id) c
      left join public.subjects sub on sub.id = c.subject_id), '[]'::jsonb),
    'by_source', coalesce((
      select jsonb_agg(jsonb_build_object('key', coalesce(src.slug, 'none'), 'label', coalesce(src.name, '—'),
                                          'label_en', coalesce(src.name, '—'), 'value', c.n) order by c.n desc)
      from (select source_id, count(*) n from public.simulations where is_active group by source_id
            order by n desc limit 15) c
      left join public.sources src on src.id = c.source_id), '[]'::jsonb),
    'by_grade', coalesce((
      select jsonb_agg(jsonb_build_object('key', g::text, 'label', 'Lớp ' || g, 'label_en', 'Grade ' || g, 'value', n) order by g)
      from (select g, count(s.id) n
            from generate_series(1, 12) g
            left join public.simulations s on s.is_active and g between s.grade_min and s.grade_max
            group by g) t), '[]'::jsonb),
    'by_language', coalesce((
      select jsonb_agg(jsonb_build_object('key', language, 'label', language, 'label_en', language, 'value', n) order by n desc)
      from (select language, count(*) n from public.simulations where is_active group by language) t), '[]'::jsonb),
    'top_simulations', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'slug', slug, 'title', title, 'views', view_count,
                                          'favorites', favorite_count, 'external_opens', external_open_count)
                       order by view_count desc)
      from (select id, slug, title, view_count, favorite_count, external_open_count
            from public.simulations where is_active and status = 'published'
            order by view_count desc, id desc limit 20) t), '[]'::jsonb),
    'top_queries', coalesce((
      select jsonb_agg(jsonb_build_object('query', query, 'count', total, 'results', results) order by total desc)
      from (select query, sum(count) total, max(last_result_count) results
            from public.search_query_stats where day > current_date - 30
            group by query order by total desc limit 20) t), '[]'::jsonb),
    'zero_result_queries', coalesce((
      select jsonb_agg(jsonb_build_object('query', query, 'count', total) order by total desc)
      from (select query, sum(count) total from public.search_query_stats
            where day > current_date - 30 and last_result_count = 0
            group by query order by total desc limit 10) t), '[]'::jsonb),
    'popular_subjects', coalesce((
      select jsonb_agg(jsonb_build_object('key', sub.slug, 'label', sub.name_vi, 'label_en', sub.name, 'value', v.total)
                       order by v.total desc)
      from (select s.subject_id, sum(d.views + d.external_opens + d.embed_opens) total
            from public.simulation_daily_stats d
            join public.simulations s on s.id = d.simulation_id
            where d.day > current_date - 30 and s.subject_id is not null
            group by s.subject_id) v
      join public.subjects sub on sub.id = v.subject_id), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'views', views, 'opens', opens) order by day)
      from (select gs::date as day,
                   coalesce(sum(d.views), 0) views,
                   coalesce(sum(d.external_opens + d.embed_opens), 0) opens
            from generate_series(current_date - 29, current_date, interval '1 day') gs
            left join public.simulation_daily_stats d on d.day = gs::date
            group by gs) t), '[]'::jsonb)
  ) into v;

  return v;
end;
$$;

-- Phát hiện bản ghi có khả năng trùng: cùng nguồn + cùng tiêu đề chuẩn hoá,
-- hoặc cùng URL sau khi bỏ query string.
create or replace function public.admin_find_duplicates(p_limit int default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set statement_timeout = '30s'
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with by_title as (
    select 'title'::text as kind, coalesce(source_id::text, '') || ':' || title_search as grp,
           array_agg(id order by created_at) ids
    from public.simulations
    group by source_id, title_search
    having count(*) > 1
    limit p_limit
  ),
  by_url as (
    select 'url'::text as kind, split_part(url_key, '?', 1) as grp, array_agg(id order by created_at) ids
    from public.simulations
    group by split_part(url_key, '?', 1)
    having count(*) > 1
    limit p_limit
  ),
  groups as (
    select * from by_title union all select * from by_url
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', g.kind,
    'key', g.grp,
    'items', (select jsonb_agg(jsonb_build_object(
                'id', s.id, 'slug', s.slug, 'title', s.title, 'simulation_url', s.simulation_url,
                'is_active', s.is_active, 'view_count', s.view_count, 'created_at', s.created_at,
                'source', (select name from public.sources where id = s.source_id))
                order by s.created_at)
              from public.simulations s where s.id = any (g.ids))
  )), '[]'::jsonb) into v
  from groups g;

  return v;
end;
$$;

-- Bảng thống kê "Student Activity" cho giáo viên (chỉ số liệu ẩn danh của bộ sưu tập của mình).
create or replace function public.teacher_collection_activity(p_days int default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'slug', c.slug, 'is_public', c.is_public, 'item_count', c.item_count,
    'total_views', c.view_count,
    'views', coalesce((select sum(d.views) from public.collection_daily_stats d
                       where d.collection_id = c.id and d.day > current_date - p_days), 0),
    'opens', coalesce((select sum(d.simulation_opens) from public.collection_daily_stats d
                       where d.collection_id = c.id and d.day > current_date - p_days), 0),
    'top', coalesce((select jsonb_agg(jsonb_build_object('title', s.title, 'slug', s.slug, 'opens', cs.opens,
                                                          'last_opened_at', cs.last_opened_at) order by cs.opens desc)
                     from (select * from public.collection_simulation_stats x
                           where x.collection_id = c.id order by x.opens desc limit 5) cs
                     join public.simulations s on s.id = cs.simulation_id), '[]'::jsonb)
  ) order by c.updated_at desc), '[]'::jsonb)
  from public.collections c
  where c.owner_id = auth.uid()
$$;
