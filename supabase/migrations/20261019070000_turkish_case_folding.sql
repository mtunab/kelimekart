-- Türkçe büyük/küçük harf düzeltmesi.
-- lower('İ') Postgres'te 'i' + U+0307 (birleşik nokta) verir; bu yüzden "BİR" araması "bir" ile eşleşmiyordu.

-- Aynı kelime anahtarı: küçük harf + birleşik nokta silinir. "İyi" = "iyi", ama "ılık" ≠ "ilik".
-- (TypeScript: src/lib/import/parse.ts → normalizeFront ile birebir aynı.)
create or replace function public.front_key(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select replace(lower(btrim(p_text)), U&'\0307', '') $$;

-- Arama anahtarı: ayrıca ı → i (arama i/ı farkına duyarsız olsun).
create or replace function public.search_fold(p_text text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select translate(replace(lower(p_text), U&'\0307', ''), 'ı', 'i') $$;

drop index if exists public.cards_deck_front_unique;
create unique index cards_deck_front_unique on public.cards (deck_id, public.front_key(front));

create or replace function public.search_cards(
  p_deck_id uuid,
  p_query text default null,
  p_tag text default null,
  p_archived boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  front text,
  back text,
  example text,
  note text,
  tags text[],
  archived boolean,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
set search_path = ''
as $$
  with q as (
    select public.search_fold(nullif(btrim(coalesce(p_query, '')), '')) as text,
           public.search_fold(nullif(btrim(coalesce(p_tag, '')), '')) as tag
  ),
  matched as (
    select c.*
    from public.cards c, q
    where c.deck_id = p_deck_id
      and c.archived = p_archived
      and (
        q.text is null
        or strpos(public.search_fold(c.front), q.text) > 0
        or strpos(public.search_fold(c.back), q.text) > 0
        or exists (select 1 from unnest(c.tags) t where strpos(public.search_fold(t), q.text) > 0)
      )
      and (q.tag is null or exists (select 1 from unnest(c.tags) t where public.search_fold(t) = q.tag))
  )
  select m.id, m.front, m.back, m.example, m.note, m.tags, m.archived, m.created_at, m.updated_at,
         count(*) over () as total_count
  from matched m
  order by m.created_at desc, m.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0)
$$;

create or replace function public.import_cards(p_deck_id uuid, p_cards jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_inserted integer;
  v_total integer := jsonb_array_length(p_cards);
begin
  if v_total > 2000 then
    raise exception 'Tek seferde en fazla 2000 kart içe aktarılabilir.' using errcode = '22023';
  end if;
  if not public.is_deck_member(p_deck_id) then
    raise exception 'Bu desteye erişimin yok.' using errcode = '42501';
  end if;

  with rows as (
    select btrim(r.front) as front, btrim(r.back) as back,
           nullif(btrim(coalesce(r.example, '')), '') as example,
           nullif(btrim(coalesce(r.note, '')), '') as note,
           coalesce(r.tags, '{}') as tags
    from jsonb_to_recordset(p_cards) as r(front text, back text, example text, note text, tags text[])
  ),
  inserted as (
    insert into public.cards (deck_id, front, back, example, note, tags)
    select p_deck_id, front, back, example, note, tags from rows
    on conflict (deck_id, public.front_key(front)) do nothing
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return jsonb_build_object('inserted', v_inserted, 'skipped', v_total - v_inserted);
end;
$$;

grant execute on function public.front_key(text), public.search_fold(text) to authenticated;
