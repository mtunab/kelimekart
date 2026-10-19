-- Aşama 2: desteler, üyelik, kartlar, kişiye özel ilerleme ve tekrar kayıtları.
-- Her tabloda RLS açık. anon (giriş yapmamış) hiçbir tabloya erişemez.

------------------------------------------------------------------------------
-- Yardımcı doğrulayıcılar
------------------------------------------------------------------------------

-- Dil kodu: "en", "tr", "de", "pt-BR" gibi.
create or replace function public.is_valid_lang(code text)
returns boolean
language sql
immutable
set search_path = ''
as $$ select code ~ '^[a-z]{2,3}(-[A-Z]{2})?$' $$;

-- Etiketler: en fazla 10 adet, her biri 1-30 karakter, baş/son boşluksuz, tekrarsız.
create or replace function public.is_valid_tags(tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(tags, 1), 0) <= 10
    and not exists (
      select 1 from unnest(tags) as t(tag)
      where tag is null or char_length(tag) not between 1 and 30 or tag <> btrim(tag)
    )
    and (select count(distinct lower(tag)) from unnest(tags) as t(tag)) = coalesce(array_length(tags, 1), 0)
$$;

------------------------------------------------------------------------------
-- Tablolar
------------------------------------------------------------------------------

create table public.decks (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  source_lang text not null default 'en' check (public.is_valid_lang(source_lang)),
  target_lang text not null default 'tr' check (public.is_valid_lang(target_lang)),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.deck_members (
  deck_id uuid not null references public.decks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (deck_id, user_id)
);
create index deck_members_user_idx on public.deck_members (user_id);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks (id) on delete cascade,
  front text not null check (char_length(btrim(front)) between 1 and 200),
  back text not null check (char_length(btrim(back)) between 1 and 500),
  example text check (example is null or char_length(example) <= 1000),
  note text check (note is null or char_length(note) <= 1000),
  tags text[] not null default '{}' check (public.is_valid_tags(tags)),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived boolean not null default false
);
-- Aynı destede aynı kelime iki kez olmasın (büyük/küçük harf ve baş/son boşluk farkı sayılmaz).
create unique index cards_deck_front_unique on public.cards (deck_id, lower(btrim(front)));
create index cards_deck_created_idx on public.cards (deck_id, created_at desc, id);
create index cards_tags_idx on public.cards using gin (tags);

-- Kişiye özel ilerleme. Alanlar ts-fsrs `Card` tipiyle birebir aynı.
create table public.card_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  due timestamptz not null,
  stability double precision not null check (stability >= 0),
  difficulty double precision not null check (difficulty >= 0),
  elapsed_days integer not null default 0 check (elapsed_days >= 0),
  scheduled_days integer not null default 0 check (scheduled_days >= 0),
  learning_steps integer not null default 0 check (learning_steps >= 0),
  reps integer not null default 0 check (reps >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  state smallint not null check (state between 0 and 3),
  last_review timestamptz,
  -- Her yazmada 1 artar; aynı anda iki cevabın birbirini ezmesini engeller.
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
-- Bugünün kuyruğu için kritik indeks.
create index card_progress_user_due_idx on public.card_progress (user_id, due);
create index card_progress_card_idx on public.card_progress (card_id);

-- Kişiye özel, sadece ekleme yapılır (güncelleme/silme yok).
create table public.review_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  rating smallint not null check (rating between 1 and 4),
  reviewed_at timestamptz not null,
  state_before smallint not null check (state_before between 0 and 3),
  due_before timestamptz,
  -- Geri alma için cevaptan önceki ilerleme (yeni kartta null).
  progress_before jsonb,
  -- Cevaptan sonra ilerlemenin sürümü; geri alma yalnızca hâlâ bu sürümdeyse yapılır.
  version_after integer not null,
  client_event_id uuid not null unique,
  created_at timestamptz not null default now()
);
create index review_logs_user_time_idx on public.review_logs (user_id, reviewed_at);
create index review_logs_user_card_idx on public.review_logs (user_id, card_id, id desc);

-- Geri alınan cevaplar. review_logs'a dokunmadan "bu cevap sayılmaz" demenin yolu.
create table public.review_log_undos (
  log_id bigint primary key references public.review_logs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.decks enable row level security;
alter table public.deck_members enable row level security;
alter table public.cards enable row level security;
alter table public.card_progress enable row level security;
alter table public.review_logs enable row level security;
alter table public.review_log_undos enable row level security;

------------------------------------------------------------------------------
-- Üyelik yardımcıları (RLS içinde döngüye girmemek için security definer)
------------------------------------------------------------------------------

create or replace function public.is_deck_member(p_deck_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.deck_members
    where deck_id = p_deck_id and user_id = (select auth.uid())
  )
$$;

create or replace function public.is_deck_owner(p_deck_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.deck_members
    where deck_id = p_deck_id and user_id = (select auth.uid()) and role = 'owner'
  )
$$;

------------------------------------------------------------------------------
-- Tetikleyiciler
------------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger cards_touch_updated_at
  before update on public.cards
  for each row execute function public.touch_updated_at();

-- Kartın destesi ve oluşturanı sonradan değiştirilemez.
create or replace function public.cards_freeze_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deck_id <> old.deck_id or new.created_by is distinct from old.created_by then
    raise exception 'Kartın destesi veya oluşturanı değiştirilemez.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger cards_freeze
  before update on public.cards
  for each row execute function public.cards_freeze_columns();

------------------------------------------------------------------------------
-- RLS politikaları
------------------------------------------------------------------------------

-- decks
create policy "decks: üyeler görür" on public.decks
  for select to authenticated using (public.is_deck_member(id));
create policy "decks: sahip günceller" on public.decks
  for update to authenticated
  using (public.is_deck_owner(id))
  with check (public.is_deck_owner(id) and owner_id = (select auth.uid()));

-- deck_members
create policy "deck_members: üyeler listeyi görür" on public.deck_members
  for select to authenticated using (public.is_deck_member(deck_id));
create policy "deck_members: sahip üye ekler" on public.deck_members
  for insert to authenticated
  with check (public.is_deck_owner(deck_id) and role = 'member');
create policy "deck_members: sahip üye çıkarır, üye kendisi ayrılır" on public.deck_members
  for delete to authenticated
  using (
    role = 'member'
    and (public.is_deck_owner(deck_id) or user_id = (select auth.uid()))
  );

-- cards
create policy "cards: üyeler görür" on public.cards
  for select to authenticated using (public.is_deck_member(deck_id));
create policy "cards: üyeler ekler" on public.cards
  for insert to authenticated
  with check (public.is_deck_member(deck_id) and created_by = (select auth.uid()));
create policy "cards: üyeler düzenler" on public.cards
  for update to authenticated
  using (public.is_deck_member(deck_id))
  with check (public.is_deck_member(deck_id));

-- Kişiye özel tablolar: yalnızca kendi satırların. Yazma yalnızca aşağıdaki fonksiyonlarla.
create policy "card_progress: kendi satırları" on public.card_progress
  for select to authenticated using (user_id = (select auth.uid()));
create policy "review_logs: kendi satırları" on public.review_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "review_log_undos: kendi satırları" on public.review_log_undos
  for select to authenticated using (user_id = (select auth.uid()));

------------------------------------------------------------------------------
-- İzinler (otomatik açma kapalı; her şey burada açıkça verilir)
------------------------------------------------------------------------------

revoke all on public.decks, public.deck_members, public.cards, public.card_progress,
  public.review_logs, public.review_log_undos from anon, authenticated;

grant select, update (name, source_lang, target_lang, archived) on public.decks to authenticated;
grant select, insert, delete on public.deck_members to authenticated;
grant select on public.cards to authenticated;
grant insert (deck_id, front, back, example, note, tags) on public.cards to authenticated;
grant update (front, back, example, note, tags, archived) on public.cards to authenticated;
grant select on public.card_progress, public.review_logs, public.review_log_undos to authenticated;

------------------------------------------------------------------------------
-- Deste oluşturma: deste + sahiplik üyeliği tek işlemde.
------------------------------------------------------------------------------

create or replace function public.create_deck(
  p_name text,
  p_source_lang text default 'en',
  p_target_lang text default 'tr'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_deck_id uuid;
begin
  if v_uid is null then
    raise exception 'Giriş gerekli.' using errcode = '42501';
  end if;
  insert into public.decks (name, source_lang, target_lang, owner_id)
  values (btrim(p_name), p_source_lang, p_target_lang, v_uid)
  returning id into v_deck_id;
  insert into public.deck_members (deck_id, user_id, role) values (v_deck_id, v_uid, 'owner');
  return v_deck_id;
end;
$$;

------------------------------------------------------------------------------
-- Gün ve seri (streak). TypeScript tarafındaki src/lib/dates.ts ile aynı kural:
-- bir "gün" kullanıcının saat dilimine göre yerel 04:00'te başlar.
------------------------------------------------------------------------------

create or replace function public.local_study_day(p_at timestamptz, p_timezone text)
returns date
language sql
immutable
set search_path = ''
as $$ select ((p_at at time zone p_timezone) - interval '4 hours')::date $$;

------------------------------------------------------------------------------
-- Cevap işleme. Yeni FSRS durumunu sunucu (Node, ts-fsrs) hesaplar; bu fonksiyon
-- kontrol eder ve ilerleme güncellemesi + kayıt eklemeyi TEK işlemde yapar.
-- Aynı client_event_id ikinci kez gelirse hiçbir şey değişmez.
------------------------------------------------------------------------------

create or replace function public.apply_review(
  p_card_id uuid,
  p_client_event_id uuid,
  p_rating smallint,
  p_reviewed_at timestamptz,
  p_expected_version integer,
  p_next jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_existing public.review_logs%rowtype;
  v_progress public.card_progress%rowtype;
  v_found boolean;
  v_version integer;
  v_log_id bigint;
  v_tz text;
  v_day date;
begin
  if v_uid is null then
    raise exception 'Giriş gerekli.' using errcode = '42501';
  end if;
  if p_rating not between 1 and 4 then
    raise exception 'Geçersiz puan.' using errcode = '22023';
  end if;
  if p_reviewed_at not between now() - interval '10 minutes' and now() + interval '10 minutes' then
    raise exception 'Geçersiz cevap zamanı.' using errcode = '22023';
  end if;

  -- Aynı olay daha önce işlendiyse: dokunma, önceki sonucu bildir.
  select * into v_existing from public.review_logs where client_event_id = p_client_event_id;
  if found then
    if v_existing.user_id <> v_uid then
      raise exception 'Geçersiz olay.' using errcode = '42501';
    end if;
    return jsonb_build_object('status', 'duplicate', 'log_id', v_existing.id);
  end if;

  -- Kart, kullanıcının üyesi olduğu bir destede ve arşivlenmemiş olmalı.
  if not exists (
    select 1
    from public.cards c
    join public.decks d on d.id = c.deck_id
    join public.deck_members m on m.deck_id = c.deck_id and m.user_id = v_uid
    where c.id = p_card_id and not c.archived and not d.archived
  ) then
    raise exception 'Bu karta erişimin yok.' using errcode = '42501';
  end if;

  select * into v_progress from public.card_progress
  where user_id = v_uid and card_id = p_card_id
  for update;
  v_found := found;
  v_version := case when v_found then v_progress.version else 0 end;

  if v_version <> p_expected_version then
    return jsonb_build_object('status', 'conflict', 'version', v_version);
  end if;

  if v_found then
    update public.card_progress set
      due = (p_next ->> 'due')::timestamptz,
      stability = (p_next ->> 'stability')::double precision,
      difficulty = (p_next ->> 'difficulty')::double precision,
      elapsed_days = (p_next ->> 'elapsed_days')::integer,
      scheduled_days = (p_next ->> 'scheduled_days')::integer,
      learning_steps = (p_next ->> 'learning_steps')::integer,
      reps = (p_next ->> 'reps')::integer,
      lapses = (p_next ->> 'lapses')::integer,
      state = (p_next ->> 'state')::smallint,
      last_review = (p_next ->> 'last_review')::timestamptz,
      version = v_version + 1,
      updated_at = now()
    where user_id = v_uid and card_id = p_card_id;
  else
    insert into public.card_progress (
      user_id, card_id, due, stability, difficulty, elapsed_days, scheduled_days,
      learning_steps, reps, lapses, state, last_review, version
    ) values (
      v_uid, p_card_id,
      (p_next ->> 'due')::timestamptz,
      (p_next ->> 'stability')::double precision,
      (p_next ->> 'difficulty')::double precision,
      (p_next ->> 'elapsed_days')::integer,
      (p_next ->> 'scheduled_days')::integer,
      (p_next ->> 'learning_steps')::integer,
      (p_next ->> 'reps')::integer,
      (p_next ->> 'lapses')::integer,
      (p_next ->> 'state')::smallint,
      (p_next ->> 'last_review')::timestamptz,
      1
    );
  end if;

  insert into public.review_logs (
    user_id, card_id, rating, reviewed_at, state_before, due_before,
    progress_before, version_after, client_event_id
  ) values (
    v_uid, p_card_id, p_rating, p_reviewed_at,
    case when v_found then v_progress.state else 0 end,
    case when v_found then v_progress.due else null end,
    case when v_found then to_jsonb(v_progress) - 'user_id' - 'card_id' - 'updated_at' else null end,
    v_version + 1,
    p_client_event_id
  )
  returning id into v_log_id;

  -- Seri: bugün ilk tekrar ise dünden devam ediyorsa +1, değilse 1.
  select timezone into v_tz from public.profiles where id = v_uid;
  v_day := public.local_study_day(p_reviewed_at, v_tz);
  update public.profiles set
    streak_count = case
      when streak_last_day = v_day then streak_count
      when streak_last_day = v_day - 1 then streak_count + 1
      else 1
    end,
    streak_last_day = greatest(coalesce(streak_last_day, v_day), v_day)
  where id = v_uid;

  return jsonb_build_object('status', 'applied', 'log_id', v_log_id, 'version', v_version + 1);
end;
$$;

------------------------------------------------------------------------------
-- Geri alma: son cevabı geri alır, ilerlemeyi önceki haline döndürür.
-- review_logs'a dokunmaz; review_log_undos'a kayıt ekler.
------------------------------------------------------------------------------

create or replace function public.undo_review(p_log_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_log public.review_logs%rowtype;
  v_progress public.card_progress%rowtype;
  v_before jsonb;
begin
  if v_uid is null then
    raise exception 'Giriş gerekli.' using errcode = '42501';
  end if;

  select * into v_log from public.review_logs where id = p_log_id and user_id = v_uid;
  if not found then
    raise exception 'Cevap bulunamadı.' using errcode = '42501';
  end if;

  if exists (select 1 from public.review_log_undos where log_id = p_log_id) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  select * into v_progress from public.card_progress
  where user_id = v_uid and card_id = v_log.card_id
  for update;

  -- Bu cevaptan sonra kart yeniden cevaplandıysa geri alma yapılamaz.
  if not found or v_progress.version <> v_log.version_after then
    return jsonb_build_object('status', 'conflict');
  end if;

  v_before := v_log.progress_before;
  if v_before is null then
    -- Kart bu cevaptan önce yeniydi: ilerleme satırı kalkar, kart tekrar "yeni" olur.
    delete from public.card_progress where user_id = v_uid and card_id = v_log.card_id;
  else
    update public.card_progress set
      due = (v_before ->> 'due')::timestamptz,
      stability = (v_before ->> 'stability')::double precision,
      difficulty = (v_before ->> 'difficulty')::double precision,
      elapsed_days = (v_before ->> 'elapsed_days')::integer,
      scheduled_days = (v_before ->> 'scheduled_days')::integer,
      learning_steps = (v_before ->> 'learning_steps')::integer,
      reps = (v_before ->> 'reps')::integer,
      lapses = (v_before ->> 'lapses')::integer,
      state = (v_before ->> 'state')::smallint,
      last_review = (v_before ->> 'last_review')::timestamptz,
      version = v_progress.version + 1,
      updated_at = now()
    where user_id = v_uid and card_id = v_log.card_id;
  end if;

  insert into public.review_log_undos (log_id, user_id) values (p_log_id, v_uid);
  return jsonb_build_object('status', 'undone', 'card_id', v_log.card_id);
end;
$$;

------------------------------------------------------------------------------
-- Fonksiyon izinleri
------------------------------------------------------------------------------

revoke execute on function
  public.is_deck_member(uuid),
  public.is_deck_owner(uuid),
  public.create_deck(text, text, text),
  public.apply_review(uuid, uuid, smallint, timestamptz, integer, jsonb),
  public.undo_review(bigint),
  public.touch_updated_at(),
  public.cards_freeze_columns()
from public, anon;

grant execute on function
  public.is_deck_member(uuid),
  public.is_deck_owner(uuid),
  public.create_deck(text, text, text),
  public.apply_review(uuid, uuid, smallint, timestamptz, integer, jsonb),
  public.undo_review(bigint)
to authenticated;
