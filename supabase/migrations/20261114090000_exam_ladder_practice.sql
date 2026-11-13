-- Vize hazırlığına göre sık merdiven + serbest tekrar (2026-11-14, Tuna'nın isteği).
--
-- Yeni basamaklar (`card_progress.learning_steps`, 0..9):
--   basamak:   1      2      3      4     5      6      7        8        9
--   bekleme:  20 sn  3 dk   30 dk  4 sa  1 gün  3 gün  1 hafta  3 hafta  2 ay
-- Bilinmeyen kart en başa (0) döner, 20 sn sonra tekrar sorulur. Hesap src/lib/srs içinde.

------------------------------------------------------------------------------
-- 1) Var olan kartlar eski merdivenden (0..6: 90 sn, 30 dk, 12 sa, 2 gün, 2 hafta, 2 ay)
--    en yakın (kısa tarafta kalan) yeni basamağa taşınır. Vade (due) değişmez.
--    Sürüm artar: taşımadan önceki bir cevap geri alınamaz (eski ölçekteki basamağı geri yazardı).
------------------------------------------------------------------------------
alter table public.card_progress drop constraint card_progress_level_range;

update public.card_progress set
  learning_steps = case learning_steps
    when 0 then 0
    when 1 then 1   -- 90 sn  → 20 sn
    when 2 then 3   -- 30 dk  → 30 dk
    when 3 then 4   -- 12 sa  → 4 sa
    when 4 then 5   -- 2 gün  → 1 gün
    when 5 then 7   -- 2 hafta → 1 hafta
    else 9          -- 2 ay   → 2 ay
  end,
  version = version + 1,
  updated_at = now();

alter table public.card_progress
  add constraint card_progress_level_range check (learning_steps between 0 and 9);

comment on column public.card_progress.learning_steps is
  'Kartın basamağı (0..9). Süreler: src/lib/srs/config.ts';

------------------------------------------------------------------------------
-- 2) Oturumda kalma penceresi 2 dk → 5 dk: 20 sn ve 3 dk'lık kartlar oturumda sorulur,
--    30 dk'lık kart çıkar. Çalışma ekranındaki LEARN_AHEAD_MS ile aynı.
------------------------------------------------------------------------------
create or replace function public.is_study_ready(p_due timestamptz, p_state smallint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_due <= now() or (p_state in (1, 3) and p_due <= now() + interval '5 minutes')
$$;

------------------------------------------------------------------------------
-- 3) İstatistik: "olgun" = 3 hafta ve üzeri aralık (8. ve 9. basamak).
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
-- 4) Serbest tekrar ("Keep practicing"): destedeki (ya da tüm destelerdeki) kartlar, vadesine
--    bakılmadan, en zayıftan başlayarak. Önce çalışılmış kartlar (düşük basamak önce, sonra en
--    yakın vade), en sonda hiç görülmemiş yeni kelimeler (eklenme sırasıyla).
--    p_exclude: oturumda zaten bulunan / bu turda gösterilmiş kartlar.
------------------------------------------------------------------------------
create or replace function public.get_practice_cards(
  p_deck_id uuid default null,
  p_exclude uuid[] default '{}',
  p_limit integer default 10
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
    select least(greatest(coalesce(p_limit, 10), 1), 50) as n
  ),
  my_decks as (
    select d.id, d.source_lang, d.target_lang
    from public.deck_members m
    join public.decks d on d.id = m.deck_id
    join me on me.id = m.user_id
    where not d.archived and (p_deck_id is null or d.id = p_deck_id)
  ),
  studied as (
    select c.id as card_id, c.deck_id, c.front, c.back, c.example, c.note,
           md.source_lang, md.target_lang, false as is_new,
           to_jsonb(p) - 'user_id' - 'card_id' - 'updated_at' as progress,
           0 as bucket, p.learning_steps as sort_level, p.due as sort_due,
           c.created_at as sort_created
    from public.card_progress p
    join me on me.id = p.user_id
    join public.cards c on c.id = p.card_id and not c.archived
    join my_decks md on md.id = c.deck_id
    where not (c.id = any (coalesce(p_exclude, '{}')))
  ),
  fresh as (
    select c.id as card_id, c.deck_id, c.front, c.back, c.example, c.note,
           md.source_lang, md.target_lang, true as is_new,
           null::jsonb as progress,
           1 as bucket, null::integer as sort_level, null::timestamptz as sort_due,
           c.created_at as sort_created
    from public.cards c
    join my_decks md on md.id = c.deck_id
    cross join me
    where not c.archived
      and not (c.id = any (coalesce(p_exclude, '{}')))
      and not exists (
        select 1 from public.card_progress p where p.user_id = me.id and p.card_id = c.id
      )
  )
  select card_id, deck_id, front, back, example, note, source_lang, target_lang, is_new, progress
  from (select * from studied union all select * from fresh) q
  order by bucket, sort_level nulls last, sort_due nulls last, sort_created, card_id
  limit (select n from lim)
$$;

revoke execute on function public.get_practice_cards(uuid, uuid[], integer) from public, anon;
grant execute on function public.get_practice_cards(uuid, uuid[], integer) to authenticated;
