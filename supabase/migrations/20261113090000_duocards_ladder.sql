-- Tekrar sistemi DuoCards'ın basamaklı sistemine geçti (2026-11-13, Tuna'nın isteği).
--
-- Her kartın bir basamağı var; `card_progress.learning_steps` artık BASAMAĞI tutar (0..6):
--   basamak:   1       2       3       4       5        6
--   bekleme:  90 sn   30 dk   12 sa   2 gün   2 hafta  2 ay
-- Bilinen kart bir basamak çıkar; bilinmeyen iki basamak iner ve 90 sn sonra tekrar sorulur.
-- Hesabı yine sunucu (src/lib/srs) yapar; apply_review ve undo_review değişmedi.
-- `state`: 1 = kısa aralık (bir günden az), 2 = uzun aralık (gün ve üzeri). 3 artık kullanılmıyor.
-- `stability` ve `difficulty` eski sistemden (FSRS) kalmadır; okunmaz, silinmedi.

------------------------------------------------------------------------------
-- 1) Var olan kartların basamağı, şu an bekledikleri aralığa göre belirlenir.
--    Vade (due) değişmez: kimsenin sırası bozulmaz.
--    Eski öğrenme adımları: 0 = az önce bilinmedi (2 dk), 1 = 30 dk, 2 = 12 sa.
------------------------------------------------------------------------------
update public.card_progress set
  learning_steps = case
    when state in (1, 3) then
      case when learning_steps <= 0 then 0 when learning_steps = 1 then 2 else 3 end
    when state = 2 then
      case when scheduled_days < 6 then 4 when scheduled_days < 30 then 5 else 6 end
    else 0
  end,
  state = case when state = 3 then 1 else state end;

alter table public.card_progress
  add constraint card_progress_level_range check (learning_steps between 0 and 6);

comment on column public.card_progress.learning_steps is
  'Kartın basamağı (0..6). Süreler: src/lib/srs/config.ts';

------------------------------------------------------------------------------
-- 2) "Bu kart şimdi çalışılabilir mi?": vadesi gelmiş kart ya da 2 dakika içinde dönecek kısa
--    aralıklı kart (90 sn'lik kartlar oturumda kalır). Eskiden 20 dakikaydı; 30 dk bekleyen kart
--    "hazır" görünüp oturumda uzun süre bekletiyordu.
--    Çalışma ekranındaki LEARN_AHEAD_MS ile aynı süre.
------------------------------------------------------------------------------
create or replace function public.is_study_ready(p_due timestamptz, p_state smallint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_due <= now() or (p_state in (1, 3) and p_due <= now() + interval '2 minutes')
$$;

------------------------------------------------------------------------------
-- 3) İstatistik: "olgun" = 2 hafta ve üzeri aralıktaki kart (5. ve 6. basamak). Eskiden 21 gündü;
--    yeni sistemde 21 gün diye bir aralık yok.
------------------------------------------------------------------------------
create or replace function public.deck_state_counts()
returns table (deck_id uuid, name text, new_count bigint, learning_count bigint, mature_count bigint)
language sql
stable
set search_path = ''
as $$
  select d.id, d.name,
    count(c.id) filter (where p.card_id is null),
    count(c.id) filter (where p.card_id is not null and (p.state <> 2 or p.scheduled_days < 14)),
    count(c.id) filter (where p.state = 2 and p.scheduled_days >= 14)
  from public.deck_members m
  join public.decks d on d.id = m.deck_id and not d.archived
  left join public.cards c on c.deck_id = d.id and not c.archived
  left join public.card_progress p on p.card_id = c.id and p.user_id = m.user_id
  where m.user_id = (select auth.uid())
  group by d.id, d.name
  order by d.name
$$;
