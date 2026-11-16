-- =====================================================================
--  MỞ Ô BÍ MẬT - Supabase schema
--  Chạy toàn bộ file này trong Supabase Dashboard > SQL Editor > Run
--  Có thể chạy lại nhiều lần (idempotent).
-- =====================================================================

create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto  with schema extensions;

-- ---------- Bảng ----------------------------------------------------

-- Tài khoản admin lưu thẳng trong DB (mật khẩu được băm bằng bcrypt)
create table if not exists public.admin_users (
  username      text primary key,
  password_hash text not null
);
create table if not exists public.admin_tokens (
  token      uuid primary key default gen_random_uuid(),
  username   text not null references public.admin_users(username) on delete cascade,
  expires_at timestamptz not null default now() + interval '12 hours'
);

-- Mỗi tuần = 1 chủ đề + 1 bộ câu hỏi
create table if not exists public.weeks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,                -- vd: "Tuần 46 - Halloween"
  theme         text not null default '',     -- chủ đề / mô tả ngắn
  emoji         text not null default '🎃',   -- hình ô
  color         text not null default '#f97316',
  week_start    date,
  is_active     boolean not null default false,
  q_count       int not null default 10 check (q_count >= 1),
  bonus_count   int not null default 3  check (bonus_count >= 0),
  boom_count    int not null default 3  check (boom_count >= 0),
  turns         int not null default 12 check (turns >= 1),
  points        int not null default 10 check (points >= 1),
  mcq_seconds   int not null default 15 check (mcq_seconds >= 5),
  text_seconds  int not null default 30 check (text_seconds >= 5),
  bonus_msg     text not null default 'Ô thưởng! Bạn được cộng điểm 🎁',
  boom_msg      text not null default 'BOOM! Bạn bị trừ điểm 💣',
  created_at    timestamptz not null default now()
);
-- chỉ 1 tuần được "đang mở" tại một thời điểm
create unique index if not exists weeks_one_active on public.weeks (is_active) where is_active;

create table if not exists public.questions (
  id         uuid primary key default gen_random_uuid(),
  week_id    uuid not null references public.weeks(id) on delete cascade,
  position   int  not null default 0,
  type       text not null default 'mcq' check (type in ('mcq','text')),
  content    text not null,
  image_url  text,
  options    jsonb,            -- mcq: ["A..","B..","C..","D.."]
  answer     text not null     -- mcq: nội dung đáp án đúng | text: các đáp án chấp nhận, ngăn cách bằng |
);
create index if not exists questions_week on public.questions (week_id);

create table if not exists public.sessions (
  id            uuid primary key default gen_random_uuid(),
  week_id       uuid not null references public.weeks(id) on delete cascade,
  player_name   text not null,
  name_key      text not null,              -- tên đã chuẩn hóa để chặn trùng
  device_id     text not null,
  cells         jsonb not null,             -- [{t:'q'|'bonus'|'boom', q:uuid?}]
  opened        jsonb not null default '[]',-- [{i,t,ok,delta}]
  pending       jsonb,                      -- câu hỏi đang chờ trả lời
  score         int  not null default 0,
  correct_count int  not null default 0,
  status        text not null default 'playing' check (status in ('playing','finished')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  duration_ms   int,
  unique (week_id, name_key),
  unique (week_id, device_id)
);
create index if not exists sessions_rank on public.sessions (week_id, score desc, duration_ms asc);

-- ---------- Hàm trợ giúp -------------------------------------------

create or replace function public.norm_text(t text) returns text
language sql stable set search_path = public, extensions as $$
  select lower(regexp_replace(extensions.unaccent(trim(coalesce(t,''))), '\s+', ' ', 'g'));
$$;

-- Dựng JSON trạng thái phiên chơi gửi về client (không chứa đáp án)
create or replace function public.session_view(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare s public.sessions; w public.weeks; q public.questions; pend jsonb := null; secs int; remain numeric;
begin
  select * into s from public.sessions where id = p_id;
  if not found then return null; end if;
  select * into w from public.weeks where id = s.week_id;
  if s.pending is not null then
    select * into q from public.questions where id = (s.pending->>'q')::uuid;
    secs := case when q.type = 'text' then w.text_seconds else w.mcq_seconds end;
    remain := greatest(0, secs - extract(epoch from (now() - (s.pending->>'started_at')::timestamptz)));
    pend := jsonb_build_object(
      'i', (s.pending->>'i')::int,
      'type', q.type,
      'content', q.content,
      'image_url', q.image_url,
      'options', case when q.type = 'mcq' then s.pending->'opts' else null end,
      'seconds', secs,
      'remaining', remain
    );
  end if;
  return jsonb_build_object(
    'id', s.id, 'week_id', s.week_id, 'player_name', s.player_name,
    'total', jsonb_array_length(s.cells), 'turns', w.turns,
    'opened', s.opened, 'pending', pend,
    'score', s.score, 'correct_count', s.correct_count,
    'status', s.status, 'duration_ms', s.duration_ms
  );
end $$;
revoke all on function public.session_view(uuid) from public, anon, authenticated;

-- ---------- RPC cho người chơi -------------------------------------

-- Tuần đang mở (công khai, chỉ thông tin hiển thị)
create or replace function public.get_active_week() returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(x) from (
    select w.id, w.title, w.theme, w.emoji, w.color, w.week_start, w.q_count, w.bonus_count, w.boom_count,
           w.turns, w.points, w.mcq_seconds, w.text_seconds, w.bonus_msg, w.boom_msg,
           (w.q_count + w.bonus_count + w.boom_count) as total_cells
    from public.weeks w where w.is_active limit 1
  ) x;
$$;

-- Thiết bị này đã chơi tuần này chưa?
create or replace function public.my_session(p_week uuid, p_device text) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.session_view(s.id) from public.sessions s
  where s.week_id = p_week and s.device_id = p_device limit 1;
$$;

-- Bắt đầu chơi. Lỗi trả về trong message: NOT_ACTIVE | BAD_NAME | NAME_TAKEN | DEVICE_PLAYED | NOT_ENOUGH_QUESTIONS | BAD_CONFIG
create or replace function public.start_session(p_week uuid, p_name text, p_device text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare w public.weeks; v_name text := regexp_replace(trim(coalesce(p_name,'')), '\s+', ' ', 'g');
        v_key text; v_cells jsonb; v_id uuid; v_qn int;
begin
  select * into w from public.weeks where id = p_week and is_active;
  if not found then raise exception 'NOT_ACTIVE'; end if;
  if length(v_name) < 2 or length(v_name) > 60 or coalesce(p_device,'') = '' then raise exception 'BAD_NAME'; end if;
  if w.turns > (w.q_count + w.bonus_count + w.boom_count) then raise exception 'BAD_CONFIG'; end if;
  v_key := public.norm_text(v_name);

  if exists (select 1 from public.sessions where week_id = p_week and device_id = p_device) then
    raise exception 'DEVICE_PLAYED'; end if;
  if exists (select 1 from public.sessions where week_id = p_week and name_key = v_key) then
    raise exception 'NAME_TAKEN'; end if;

  select count(*) into v_qn from public.questions where week_id = p_week;
  if v_qn < w.q_count then raise exception 'NOT_ENOUGH_QUESTIONS'; end if;

  select jsonb_agg(c order by random()) into v_cells from (
    select jsonb_build_object('t','q','q',id) as c
      from (select id from public.questions where week_id = p_week order by random() limit w.q_count) a
    union all select jsonb_build_object('t','bonus') from generate_series(1, w.bonus_count)
    union all select jsonb_build_object('t','boom')  from generate_series(1, w.boom_count)
  ) s;

  begin
    insert into public.sessions (week_id, player_name, name_key, device_id, cells)
    values (p_week, v_name, v_key, p_device, v_cells) returning id into v_id;
  exception when unique_violation then
    raise exception 'NAME_TAKEN';
  end;
  return public.session_view(v_id);
end $$;

-- Khôi phục phiên (khi tải lại trang)
create or replace function public.get_session(p_session uuid, p_device text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.sessions where id = p_session and device_id = p_device) then
    raise exception 'FORBIDDEN'; end if;
  return public.session_view(p_session);
end $$;

-- Mở 1 ô
create or replace function public.open_cell(p_session uuid, p_device text, p_idx int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.sessions; w public.weeks; cell jsonb; delta int; res jsonb; opts jsonb;
begin
  select * into s from public.sessions where id = p_session and device_id = p_device for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  select * into w from public.weeks where id = s.week_id;
  if s.status <> 'playing' then raise exception 'FINISHED'; end if;
  if s.pending is not null then raise exception 'PENDING'; end if;
  if p_idx is null or p_idx < 0 or p_idx >= jsonb_array_length(s.cells) then raise exception 'BAD_CELL'; end if;
  if exists (select 1 from jsonb_array_elements(s.opened) o where (o->>'i')::int = p_idx) then
    raise exception 'ALREADY_OPENED'; end if;

  cell := s.cells -> p_idx;
  if cell->>'t' = 'q' then
    select jsonb_agg(o order by random()) into opts
      from public.questions qq, jsonb_array_elements_text(coalesce(qq.options,'[]'::jsonb)) o
      where qq.id = (cell->>'q')::uuid;
    update public.sessions
      set pending = jsonb_build_object('i', p_idx, 'q', cell->>'q', 'opts', coalesce(opts,'[]'::jsonb), 'started_at', now())
      where id = s.id;
    return jsonb_build_object('kind','question','session', public.session_view(s.id));
  end if;

  delta := case when cell->>'t' = 'bonus' then w.points else -w.points end;
  res := jsonb_build_object('i', p_idx, 't', cell->>'t', 'delta', delta);
  update public.sessions set opened = opened || res, score = score + delta where id = s.id;
  perform public.finish_if_done(s.id);
  return jsonb_build_object('kind', cell->>'t', 'delta', delta, 'session', public.session_view(s.id));
end $$;

-- Kết thúc nếu đã đủ lượt
create or replace function public.finish_if_done(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s public.sessions; w public.weeks;
begin
  select * into s from public.sessions where id = p_id;
  select * into w from public.weeks where id = s.week_id;
  if s.status = 'playing' and jsonb_array_length(s.opened) >= w.turns then
    update public.sessions set status = 'finished', finished_at = now(),
      duration_ms = (extract(epoch from (now() - s.started_at)) * 1000)::int
    where id = p_id;
  end if;
end $$;
revoke all on function public.finish_if_done(uuid) from public, anon, authenticated;

-- Trả lời câu đang mở (p_answer rỗng/null = hết giờ)
create or replace function public.answer_question(p_session uuid, p_device text, p_answer text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.sessions; w public.weeks; q public.questions; secs int; elapsed numeric; ok boolean := false;
        delta int := 0; res jsonb; a text;
begin
  select * into s from public.sessions where id = p_session and device_id = p_device for update;
  if not found then raise exception 'FORBIDDEN'; end if;
  if s.pending is null then raise exception 'NO_PENDING'; end if;
  select * into w from public.weeks where id = s.week_id;
  select * into q from public.questions where id = (s.pending->>'q')::uuid;
  secs := case when q.type = 'text' then w.text_seconds else w.mcq_seconds end;
  elapsed := extract(epoch from (now() - (s.pending->>'started_at')::timestamptz));

  if elapsed <= secs + 3 and coalesce(trim(p_answer),'') <> '' then   -- +3s du di mạng
    if q.type = 'mcq' then
      ok := public.norm_text(p_answer) = public.norm_text(q.answer);
    else
      foreach a in array string_to_array(q.answer, '|') loop
        if public.norm_text(p_answer) = public.norm_text(a) then ok := true; end if;
      end loop;
    end if;
  end if;
  if ok then delta := w.points; end if;

  res := jsonb_build_object('i', (s.pending->>'i')::int, 't', 'q', 'ok', ok, 'delta', delta);
  update public.sessions
    set opened = opened || res, score = score + delta,
        correct_count = correct_count + (case when ok then 1 else 0 end), pending = null
    where id = s.id;
  perform public.finish_if_done(s.id);
  return jsonb_build_object('kind','answer','ok', ok, 'delta', delta,
                            'correct_answer', replace(q.answer, '|', ' / '),
                            'session', public.session_view(s.id));
end $$;

-- Bảng xếp hạng 1 tuần: điểm cao -> hoàn thành nhanh -> nộp sớm
create or replace function public.leaderboard(p_week uuid, p_limit int default 200)
returns table (rank bigint, player_name text, score int, correct_count int, duration_ms int, finished_at timestamptz)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by s.score desc, s.duration_ms asc, s.finished_at asc),
         s.player_name, s.score, s.correct_count, s.duration_ms, s.finished_at
  from public.sessions s
  where s.week_id = p_week and s.status = 'finished'
  order by 1 limit greatest(p_limit, 1);
$$;

-- Top 3 của mọi tuần (bảng vinh danh)
create or replace function public.weekly_winners()
returns table (week_id uuid, title text, theme text, emoji text, week_start date, rank bigint,
               player_name text, score int, correct_count int, duration_ms int)
language sql stable security definer set search_path = public as $$
  select * from (
    select w.id, w.title, w.theme, w.emoji, w.week_start,
           row_number() over (partition by w.id order by s.score desc, s.duration_ms asc, s.finished_at asc) as rk,
           s.player_name, s.score, s.correct_count, s.duration_ms
    from public.weeks w join public.sessions s on s.week_id = w.id and s.status = 'finished'
  ) t where rk <= 3
  order by week_start desc nulls last, title desc, rk;
$$;

-- Danh sách tuần để xem lại bảng xếp hạng (không lộ câu hỏi)
create or replace function public.list_weeks() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.week_start desc nulls last, x.created_at desc), '[]')
  from (select id, title, theme, emoji, color, week_start, is_active, created_at from public.weeks) x;
$$;

grant execute on function
  public.get_active_week(), public.my_session(uuid,text), public.start_session(uuid,text,text),
  public.get_session(uuid,text), public.open_cell(uuid,text,int), public.answer_question(uuid,text,text),
  public.leaderboard(uuid,int), public.weekly_winners(), public.list_weeks()
to anon, authenticated;

-- ---------- Dọn bản cũ (dùng Supabase Auth), an toàn nếu chạy lần đầu ----
drop policy if exists weeks_admin    on public.weeks;
drop policy if exists q_admin        on public.questions;
drop policy if exists sessions_admin on public.sessions;
drop table    if exists public.admins;
drop function if exists public.is_admin();

-- ---------- Row Level Security -------------------------------------
-- Bật RLS và KHÔNG tạo policy nào = trình duyệt không đọc/ghi trực tiếp được bảng nào.
-- Mọi thao tác đều đi qua các hàm RPC ở trên (người chơi) và bên dưới (admin).
alter table public.weeks        enable row level security;
alter table public.questions    enable row level security;
alter table public.sessions     enable row level security;
alter table public.admin_users  enable row level security;
alter table public.admin_tokens enable row level security;

-- =====================================================================
--  ADMIN
-- =====================================================================

-- Tài khoản mặc định: may_group / 123456  (đổi mật khẩu: xem README)
insert into public.admin_users (username, password_hash)
values ('may_group', extensions.crypt('123456', extensions.gen_salt('bf')))
on conflict (username) do nothing;

-- Đăng nhập: trả về token (hết hạn sau 12 giờ)
create or replace function public.admin_login(p_user text, p_pass text) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare u public.admin_users; t uuid;
begin
  select * into u from public.admin_users where username = lower(trim(coalesce(p_user,'')));
  if not found or u.password_hash <> extensions.crypt(coalesce(p_pass,''), u.password_hash) then
    raise exception 'BAD_LOGIN';
  end if;
  delete from public.admin_tokens where expires_at < now();
  insert into public.admin_tokens (username) values (u.username) returning token into t;
  return t;
end $$;

create or replace function public.admin_guard(p_token uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if p_token is null or not exists (select 1 from public.admin_tokens where token = p_token and expires_at > now()) then
    raise exception 'UNAUTHORIZED';
  end if;
end $$;
revoke all on function public.admin_guard(uuid) from public, anon, authenticated;

create or replace function public.admin_check_token(p_token uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_token is not null and exists (select 1 from public.admin_tokens where token = p_token and expires_at > now());
$$;

create or replace function public.admin_list_weeks(p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard(p_token);
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.week_start desc nulls last, x.created_at desc) from (
      select w.*,
        (select count(*) from public.questions q where q.week_id = w.id) as q_total,
        (select count(*) from public.sessions s  where s.week_id = w.id) as s_total
      from public.weeks w) x
  ), '[]'::jsonb);
end $$;

create or replace function public.admin_get_week(p_token uuid, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.admin_guard(p_token);
  return jsonb_build_object(
    'week', (select to_jsonb(w) from public.weeks w where w.id = p_id),
    'questions', coalesce((select jsonb_agg(to_jsonb(q) order by q.position) from public.questions q where q.week_id = p_id), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'player_name', s.player_name, 'score', s.score,
               'correct_count', s.correct_count, 'status', s.status, 'duration_ms', s.duration_ms,
               'started_at', s.started_at, 'finished_at', s.finished_at)
             order by s.score desc, s.duration_ms asc nulls last)
      from public.sessions s where s.week_id = p_id), '[]'::jsonb)
  );
end $$;

-- Tạo mới (không có id) hoặc cập nhật tuần
create or replace function public.admin_save_week(p_token uuid, p_week jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p_week->>'id','')::uuid;
begin
  perform public.admin_guard(p_token);
  if v_id is null then
    insert into public.weeks (title) values (coalesce(nullif(trim(p_week->>'title'),''), 'Tuần mới')) returning id into v_id;
  end if;
  update public.weeks set
    title        = coalesce(nullif(trim(p_week->>'title'),''), title),
    theme        = coalesce(p_week->>'theme', theme),
    emoji        = coalesce(nullif(p_week->>'emoji',''), emoji),
    color        = coalesce(nullif(p_week->>'color',''), color),
    week_start   = case when p_week ? 'week_start' then nullif(p_week->>'week_start','')::date else week_start end,
    q_count      = coalesce((p_week->>'q_count')::int, q_count),
    bonus_count  = coalesce((p_week->>'bonus_count')::int, bonus_count),
    boom_count   = coalesce((p_week->>'boom_count')::int, boom_count),
    turns        = coalesce((p_week->>'turns')::int, turns),
    points       = coalesce((p_week->>'points')::int, points),
    mcq_seconds  = coalesce((p_week->>'mcq_seconds')::int, mcq_seconds),
    text_seconds = coalesce((p_week->>'text_seconds')::int, text_seconds),
    bonus_msg    = coalesce(p_week->>'bonus_msg', bonus_msg),
    boom_msg     = coalesce(p_week->>'boom_msg', boom_msg)
  where id = v_id;
  return v_id;
end $$;

create or replace function public.admin_set_active(p_token uuid, p_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard(p_token);
  if p_on then update public.weeks set is_active = false where is_active; end if;
  update public.weeks set is_active = p_on where id = p_id;
end $$;

create or replace function public.admin_delete_week(p_token uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard(p_token);
  delete from public.weeks where id = p_id;
end $$;

-- p_mode: 'append' | 'replace'. p_questions: [{type, content, image_url, options, answer}]
create or replace function public.admin_import_questions(p_token uuid, p_week uuid, p_mode text, p_questions jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare base int; n int;
begin
  perform public.admin_guard(p_token);
  if p_mode = 'replace' then delete from public.questions where week_id = p_week; end if;
  select coalesce(max(position), 0) into base from public.questions where week_id = p_week;
  insert into public.questions (week_id, position, type, content, image_url, options, answer)
  select p_week, base + t.ord, e->>'type', e->>'content', nullif(e->>'image_url',''),
         case when jsonb_typeof(e->'options') = 'array' then e->'options' else null end, e->>'answer'
  from jsonb_array_elements(p_questions) with ordinality as t(e, ord);
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.admin_delete_question(p_token uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard(p_token);
  delete from public.questions where id = p_id;
end $$;

create or replace function public.admin_delete_session(p_token uuid, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard(p_token);
  delete from public.sessions where id = p_id;
end $$;

create or replace function public.admin_clear_sessions(p_token uuid, p_week uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard(p_token);
  delete from public.sessions where week_id = p_week;
end $$;

grant execute on function
  public.admin_login(text,text), public.admin_check_token(uuid), public.admin_list_weeks(uuid),
  public.admin_get_week(uuid,uuid), public.admin_save_week(uuid,jsonb), public.admin_set_active(uuid,uuid,boolean),
  public.admin_delete_week(uuid,uuid), public.admin_import_questions(uuid,uuid,text,jsonb),
  public.admin_delete_question(uuid,uuid), public.admin_delete_session(uuid,uuid),
  public.admin_clear_sessions(uuid,uuid)
to anon, authenticated;
