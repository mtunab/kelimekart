-- Aşama 3: deste/kart yönetimi için sorgu fonksiyonları.
-- Hepsi SECURITY INVOKER (varsayılan): çağıranın RLS kuralları geçerlidir.
-- Yalnızca list_group_profiles security definer'dır ve sadece id + ad döndürür.

------------------------------------------------------------------------------
-- Grup üyeleri (en fazla 5 kişi): sadece id ve görünen ad.
------------------------------------------------------------------------------
create or replace function public.list_group_profiles()
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name
  from public.profiles p
  where (select auth.uid()) is not null
  order by p.display_name
$$;

------------------------------------------------------------------------------
-- Desteler ve sayılar (tek sorgu). Vade sayıları çağıran kişiye özeldir.
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
    count(c.id) filter (where p.due <= now()) as due_count,
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
-- Kart arama + sayfalama. Arama ön/arka/etikette, büyük/küçük harf duyarsız.
------------------------------------------------------------------------------
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
    select nullif(btrim(coalesce(p_query, '')), '') as text,
           nullif(btrim(coalesce(p_tag, '')), '') as tag
  ),
  matched as (
    select c.*
    from public.cards c, q
    where c.deck_id = p_deck_id
      and c.archived = p_archived
      and (
        q.text is null
        or strpos(lower(c.front), lower(q.text)) > 0
        or strpos(lower(c.back), lower(q.text)) > 0
        or exists (select 1 from unnest(c.tags) t where strpos(lower(t), lower(q.text)) > 0)
      )
      and (q.tag is null or exists (select 1 from unnest(c.tags) t where lower(t) = lower(q.tag)))
  )
  select m.id, m.front, m.back, m.example, m.note, m.tags, m.archived, m.created_at, m.updated_at,
         count(*) over () as total_count
  from matched m
  order by m.created_at desc, m.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0)
$$;

------------------------------------------------------------------------------
-- Destedeki etiketler (filtre için).
------------------------------------------------------------------------------
create or replace function public.deck_tags(p_deck_id uuid)
returns table (tag text, card_count bigint)
language sql
stable
set search_path = ''
as $$
  select t.tag, count(*) as card_count
  from public.cards c, unnest(c.tags) as t(tag)
  where c.deck_id = p_deck_id and not c.archived
  group by t.tag
  order by lower(t.tag)
$$;

------------------------------------------------------------------------------
-- Toplu içe aktarma: TEK işlem. Zaten var olan kelimeler atlanır (ezilmez).
-- p_cards: [{front, back, example?, note?, tags?}]
------------------------------------------------------------------------------
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
    on conflict (deck_id, lower(btrim(front))) do nothing
    returning 1
  )
  select count(*) into v_inserted from inserted;

  return jsonb_build_object('inserted', v_inserted, 'skipped', v_total - v_inserted);
end;
$$;

------------------------------------------------------------------------------
-- İzinler
------------------------------------------------------------------------------
revoke execute on function
  public.list_group_profiles(),
  public.deck_summaries(boolean),
  public.search_cards(uuid, text, text, boolean, integer, integer),
  public.deck_tags(uuid),
  public.import_cards(uuid, jsonb)
from public, anon;

grant execute on function
  public.list_group_profiles(),
  public.deck_summaries(boolean),
  public.search_cards(uuid, text, text, boolean, integer, integer),
  public.deck_tags(uuid),
  public.import_cards(uuid, jsonb)
to authenticated;
