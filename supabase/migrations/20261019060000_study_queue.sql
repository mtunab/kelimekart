-- Aşama 4: çalışma kuyruğu, bugünün özeti ve vade tahmini.
-- Hepsi SECURITY INVOKER: yalnızca çağıranın kendi verisi (RLS) kullanılır.

-- Çalışma gününün başladığı an (yerel 04:00). local_study_day'in tersi.
create or replace function public.study_day_start(p_day date, p_timezone text)
returns timestamptz
language sql
immutable
set search_path = ''
as $$ select ((p_day + time '04:00') at time zone p_timezone) $$;

------------------------------------------------------------------------------
-- Bugünün kuyruğu (TEK sorgu):
--   1) vadesi gelmiş kartlar (card_progress (user_id, due) indeksiyle)
--      + 20 dk içinde vadesi gelecek öğrenme adımındaki kartlar
--   2) günlük yeni kart limitine kadar, kullanıcı için hiç cevaplanmamış kartlar
--      (ilerleme satırı ilk cevapta tembel oluşur)
------------------------------------------------------------------------------
create or replace function public.get_study_queue(
  p_deck_id uuid default null,
  p_due_limit integer default 200
)
returns table (
  card_id uuid,
  deck_id uuid,
  front text,
  back text,
  example text,
  note text,
  source_lang text,
  target_lang text,
  is_new boolean,
  progress jsonb
)
language sql
stable
set search_path = ''
as $$
  with me as (
    select p.id, p.daily_new_limit,
           public.study_day_start(public.local_study_day(now(), p.timezone), p.timezone) as day_start
    from public.profiles p
    where p.id = (select auth.uid())
  ),
  new_today as (
    select count(*) as n
    from public.review_logs l, me
    where l.user_id = me.id
      and l.reviewed_at >= me.day_start
      and l.state_before = 0
      and not exists (select 1 from public.review_log_undos u where u.log_id = l.id)
  ),
  my_decks as (
    select d.id, d.source_lang, d.target_lang
    from public.deck_members m
    join public.decks d on d.id = m.deck_id
    join me on me.id = m.user_id
    where not d.archived and (p_deck_id is null or d.id = p_deck_id)
  ),
  due as (
    select c.id as card_id, c.deck_id, c.front, c.back, c.example, c.note,
           md.source_lang, md.target_lang, false as is_new,
           to_jsonb(p) - 'user_id' - 'card_id' - 'updated_at' as progress,
           p.due as sort_due, c.created_at as sort_created
    from public.card_progress p
    join me on me.id = p.user_id
    join public.cards c on c.id = p.card_id and not c.archived
    join my_decks md on md.id = c.deck_id
    where p.due <= now()
       or (p.state in (1, 3) and p.due <= now() + interval '20 minutes')
    order by p.due
    limit greatest(p_due_limit, 0)
  ),
  fresh as (
    select c.id as card_id, c.deck_id, c.front, c.back, c.example, c.note,
           md.source_lang, md.target_lang, true as is_new,
           null::jsonb as progress,
           null::timestamptz as sort_due, c.created_at as sort_created
    from public.cards c
    join my_decks md on md.id = c.deck_id
    cross join me
    where not c.archived
      and not exists (
        select 1 from public.card_progress p where p.user_id = me.id and p.card_id = c.id
      )
    order by c.created_at, c.id
    limit greatest((select daily_new_limit from me) - (select n from new_today), 0)
  )
  select card_id, deck_id, front, back, example, note, source_lang, target_lang, is_new, progress
  from (
    select *, 0 as bucket from due
    union all
    select *, 1 as bucket from fresh
  ) q
  order by bucket, sort_due nulls last, sort_created, card_id
$$;

------------------------------------------------------------------------------
-- Bugünün özeti: tekrar sayısı, doğru sayısı, yeni kart sayısı, hedef, seri.
------------------------------------------------------------------------------
create or replace function public.study_today()
returns table (
  reviews_today bigint,
  correct_today bigint,
  new_today bigint,
  daily_goal integer,
  daily_new_limit integer,
  streak_count integer,
  streak_last_day date,
  today date,
  timezone text
)
language sql
stable
set search_path = ''
as $$
  with me as (
    select p.*, public.local_study_day(now(), p.timezone) as today_day
    from public.profiles p
    where p.id = (select auth.uid())
  ),
  logs as (
    select l.rating, l.state_before
    from public.review_logs l, me
    where l.user_id = me.id
      and l.reviewed_at >= public.study_day_start(me.today_day, me.timezone)
      and not exists (select 1 from public.review_log_undos u where u.log_id = l.id)
  )
  select
    (select count(*) from logs),
    (select count(*) from logs where rating >= 2),
    (select count(*) from logs where state_before = 0),
    me.daily_goal_reviews, me.daily_new_limit, me.streak_count, me.streak_last_day,
    me.today_day, me.timezone
  from me
$$;

------------------------------------------------------------------------------
-- Vade tahmini: önümüzdeki N gün için her gün kaç kart vadesi dolacak.
-- Gecikmiş kartlar bugüne sayılır. Gün sınırı kullanıcının yerel 04:00'ü.
------------------------------------------------------------------------------
create or replace function public.due_forecast(p_days integer default 14)
returns table (day date, due_count bigint)
language sql
stable
set search_path = ''
as $$
  with me as (
    select p.id, p.timezone, public.local_study_day(now(), p.timezone) as today_day
    from public.profiles p
    where p.id = (select auth.uid())
  ),
  days as (
    select (me.today_day + g)::date as day
    from me, generate_series(0, least(greatest(p_days, 1), 60) - 1) as g
  ),
  counts as (
    select greatest(public.local_study_day(p.due, me.timezone), me.today_day) as day, count(*) as n
    from public.card_progress p
    join me on me.id = p.user_id
    join public.cards c on c.id = p.card_id and not c.archived
    join public.decks d on d.id = c.deck_id and not d.archived
    join public.deck_members m on m.deck_id = d.id and m.user_id = me.id
    where p.due < public.study_day_start(me.today_day + least(greatest(p_days, 1), 60), me.timezone)
    group by 1
  )
  select days.day, coalesce(counts.n, 0) as due_count
  from days left join counts on counts.day = days.day
  order by days.day
$$;

revoke execute on function
  public.get_study_queue(uuid, integer),
  public.study_today(),
  public.due_forecast(integer)
from public, anon;

grant execute on function
  public.get_study_queue(uuid, integer),
  public.study_today(),
  public.due_forecast(integer),
  public.study_day_start(date, text),
  public.local_study_day(timestamptz, text)
to authenticated;
