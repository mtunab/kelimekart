-- Aşama 5: istatistikler ve grup panosu.
-- Geri alınan cevaplar (review_log_undos) hiçbir sayıma girmez.
-- Kart durumları: Yeni (hiç cevaplanmamış), Öğreniliyor (öğrenme/yeniden öğrenme ya da aralık < 21 gün),
-- Olgun (tekrar durumunda ve aralık ≥ 21 gün; Anki ile aynı eşik).

------------------------------------------------------------------------------
-- Kişisel özet (tek sorgu): bugün, son 7 gün, doğruluk, seri.
------------------------------------------------------------------------------
create or replace function public.my_stats()
returns table (
  reviews_today bigint,
  correct_today bigint,
  reviews_week bigint,
  correct_week bigint,
  streak integer,
  today date
)
language sql
stable
set search_path = ''
as $$
  with me as (
    select p.id, p.timezone, p.streak_count, p.streak_last_day,
           public.local_study_day(now(), p.timezone) as today_day
    from public.profiles p
    where p.id = (select auth.uid())
  ),
  logs as (
    select l.rating, l.reviewed_at
    from public.review_logs l
    join me on me.id = l.user_id
    where l.reviewed_at >= public.study_day_start(me.today_day - 6, me.timezone)
      and not exists (select 1 from public.review_log_undos u where u.log_id = l.id)
  )
  select
    count(*) filter (where l.reviewed_at >= public.study_day_start(me.today_day, me.timezone)),
    count(*) filter (where l.reviewed_at >= public.study_day_start(me.today_day, me.timezone) and l.rating >= 2),
    count(l.rating),
    count(*) filter (where l.rating >= 2),
    case when me.streak_last_day >= me.today_day - 1 then me.streak_count else 0 end,
    me.today_day
  from me
  left join logs l on true
  group by me.id, me.streak_count, me.streak_last_day, me.today_day, me.timezone
$$;

------------------------------------------------------------------------------
-- Son N günün günlük tekrar sayıları (grafik için).
------------------------------------------------------------------------------
create or replace function public.daily_reviews(p_days integer default 7)
returns table (day date, reviews bigint, correct bigint)
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
    select (me.today_day - g)::date as day
    from me, generate_series(0, least(greatest(p_days, 1), 60) - 1) as g
  ),
  logs as (
    select public.local_study_day(l.reviewed_at, me.timezone) as day, l.rating
    from public.review_logs l
    join me on me.id = l.user_id
    where l.reviewed_at >= public.study_day_start(me.today_day - (least(greatest(p_days, 1), 60) - 1), me.timezone)
      and not exists (select 1 from public.review_log_undos u where u.log_id = l.id)
  )
  select d.day, count(l.rating), count(*) filter (where l.rating >= 2)
  from days d
  left join logs l on l.day = d.day
  group by d.day
  order by d.day
$$;

------------------------------------------------------------------------------
-- Destelere göre kart durumları (kişiye özel).
------------------------------------------------------------------------------
create or replace function public.deck_state_counts()
returns table (deck_id uuid, name text, new_count bigint, learning_count bigint, mature_count bigint)
language sql
stable
set search_path = ''
as $$
  select d.id, d.name,
    count(c.id) filter (where p.card_id is null),
    count(c.id) filter (where p.card_id is not null and (p.state <> 2 or p.scheduled_days < 21)),
    count(c.id) filter (where p.state = 2 and p.scheduled_days >= 21)
  from public.deck_members m
  join public.decks d on d.id = m.deck_id and not d.archived
  left join public.cards c on c.deck_id = d.id and not c.archived
  left join public.card_progress p on p.card_id = c.id and p.user_id = m.user_id
  where m.user_id = (select auth.uid())
  group by d.id, d.name
  order by d.name
$$;

------------------------------------------------------------------------------
-- Grup panosu: herkesin SADECE adı, bugünkü tekrar sayısı (kendi saat dilimine göre) ve serisi.
-- Başkasının hangi kartı bildiği/yanlış yaptığı gibi ayrıntılar döndürülmez.
------------------------------------------------------------------------------
create or replace function public.group_board()
returns table (display_name text, reviews_today bigint, streak integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.display_name,
    (
      select count(*)
      from public.review_logs l
      where l.user_id = p.id
        and l.reviewed_at >= public.study_day_start(public.local_study_day(now(), p.timezone), p.timezone)
        and not exists (select 1 from public.review_log_undos u where u.log_id = l.id)
    ),
    case
      when p.streak_last_day >= public.local_study_day(now(), p.timezone) - 1 then p.streak_count
      else 0
    end,
    p.id = (select auth.uid())
  from public.profiles p
  where (select auth.uid()) is not null
  order by 2 desc, 3 desc, p.display_name
$$;

revoke execute on function
  public.my_stats(),
  public.daily_reviews(integer),
  public.deck_state_counts(),
  public.group_board()
from public, anon;

grant execute on function
  public.my_stats(),
  public.daily_reviews(integer),
  public.deck_state_counts(),
  public.group_board()
to authenticated;
