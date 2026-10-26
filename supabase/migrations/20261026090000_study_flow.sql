-- Çalışma akışı düzeltmeleri (2026-10-26):
-- 1) "Bu kart şimdi çalışılabilir mi?" kuralı TEK yerde: is_study_ready(). Hem çalışma kuyruğu
--    hem ana sayfadaki sayılar bunu kullanır; ikisi artık birbirinden farklı şey söyleyemez.
--    (Önceden ana sayfa 20 dakika içinde dönecek öğrenme kartlarını saymıyordu, "Start" düğmesi
--    birkaç dakika kayboluyordu.)
-- 2) get_extra_cards(): günlük hedefe ulaşılmadan liste biterse çalışma ekranı buradan ek kart
--    çeker: önce yeni kelimeler (günlük yeni kart sınırının ötesinde), kalmazsa en yakında tekrar
--    zamanı gelecek kartlar (erken tekrar; FSRS bunu doğru hesaplar).

------------------------------------------------------------------------------
-- Ortak kural: vadesi gelmiş kart ya da 20 dakika içinde dönecek öğrenme/yeniden öğrenme kartı.
------------------------------------------------------------------------------
create or replace function public.is_study_ready(p_due timestamptz, p_state smallint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_due <= now() or (p_state in (1, 3) and p_due <= now() + interval '20 minutes')
$$;

------------------------------------------------------------------------------
-- Deste özetleri: due_count artık çalışma kuyruğuyla aynı kuralı kullanır.
------------------------------------------------------------------------------
create or replace function public.deck_summaries(p_include_archived boolean default false)
returns table (
  id uuid,
  name text,
  source_lang text,
  target_lang text,
  archived boolean,
  role text,
  card_count bigint,
  new_count bigint,
  due_count bigint,
  created_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    d.id, d.name, d.source_lang, d.target_lang, d.archived, m.role,
    count(c.id) as card_count,
    count(c.id) filter (where p.card_id is null) as new_count,
    count(c.id) filter (where public.is_study_ready(p.due, p.state)) as due_count,
    d.created_at
  from public.deck_members m
  join public.decks d on d.id = m.deck_id
  left join public.cards c on c.deck_id = d.id and not c.archived
  left join public.card_progress p on p.card_id = c.id and p.user_id = m.user_id
  where m.user_id = (select auth.uid())
    and (p_include_archived or not d.archived)
  group by d.id, m.role
  order by d.archived, d.created_at desc
$$;

------------------------------------------------------------------------------
-- Çalışma kuyruğu: aynı kural (is_study_ready). Geri kalanı değişmedi.
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
    where public.is_study_ready(p.due, p.state)
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
-- Ek kartlar: günlük hedefe ulaşılmadan liste biterse. Önce yeni kelimeler (sınırın ötesinde),
-- yetmezse vadesi henüz gelmemiş tekrar kartları (en yakın vadeli önce). Öğrenme adımındaki
-- kartlar hariç: onlar zaten oturumda kendi zamanlarını bekliyor. p_exclude: oturumda görülenler.
------------------------------------------------------------------------------
create or replace function public.get_extra_cards(
  p_deck_id uuid default null,
  p_exclude uuid[] default '{}',
  p_limit integer default 5
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
    select (select auth.uid()) as id
  ),
  lim as (
    select least(greatest(coalesce(p_limit, 5), 1), 50) as n
  ),
  my_decks as (
    select d.id, d.source_lang, d.target_lang
    from public.deck_members m
    join public.decks d on d.id = m.deck_id
    join me on me.id = m.user_id
    where not d.archived and (p_deck_id is null or d.id = p_deck_id)
  ),
  fresh as (
    select c.id as card_id, c.deck_id, c.front, c.back, c.example, c.note,
           md.source_lang, md.target_lang, true as is_new,
           null::jsonb as progress,
           0 as bucket, null::timestamptz as sort_due, c.created_at as sort_created
    from public.cards c
    join my_decks md on md.id = c.deck_id
    cross join me
    where not c.archived
      and not (c.id = any (coalesce(p_exclude, '{}')))
      and not exists (
        select 1 from public.card_progress p where p.user_id = me.id and p.card_id = c.id
      )
    order by c.created_at, c.id
    limit (select n from lim)
  ),
  ahead as (
    select c.id as card_id, c.deck_id, c.front, c.back, c.example, c.note,
           md.source_lang, md.target_lang, false as is_new,
           to_jsonb(p) - 'user_id' - 'card_id' - 'updated_at' as progress,
           1 as bucket, p.due as sort_due, c.created_at as sort_created
    from public.card_progress p
    join me on me.id = p.user_id
    join public.cards c on c.id = p.card_id and not c.archived
    join my_decks md on md.id = c.deck_id
    where p.state = 2
      and not (c.id = any (coalesce(p_exclude, '{}')))
    order by p.due
    limit (select n from lim)
  )
  select card_id, deck_id, front, back, example, note, source_lang, target_lang, is_new, progress
  from (select * from fresh union all select * from ahead) q
  order by bucket, sort_due nulls last, sort_created, card_id
  limit (select n from lim)
$$;

------------------------------------------------------------------------------
-- İzinler
------------------------------------------------------------------------------
revoke execute on function
  public.is_study_ready(timestamptz, smallint),
  public.get_extra_cards(uuid, uuid[], integer)
from public, anon;

grant execute on function
  public.is_study_ready(timestamptz, smallint),
  public.get_extra_cards(uuid, uuid[], integer)
to authenticated;
