-- Aşama 1: profiller, 5 kişi sınırı, yeni kullanıcıya otomatik profil.

-- Grubun en fazla kişi sayısı. Sınırın tanımlandığı TEK yer burası.
create or replace function public.max_profiles()
returns integer
language sql
immutable
set search_path = ''
as $$ select 5 $$;

-- Saat dilimi adı Postgres'in tanıdığı bir ad mı? (ör. 'Europe/Istanbul')
create or replace function public.is_valid_timezone(tz text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  perform now() at time zone tz;
  return true;
exception when others then
  return false;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  timezone text not null default 'Europe/Istanbul' check (public.is_valid_timezone(timezone)),
  daily_new_limit integer not null default 10 check (daily_new_limit between 0 and 200),
  daily_goal_reviews integer not null default 30 check (daily_goal_reviews between 1 and 1000),
  streak_count integer not null default 0 check (streak_count >= 0),
  streak_last_day date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 6. profil oluşturulamaz. Aynı anda iki kayıt yarışmasın diye kilitli sayım.
create or replace function public.enforce_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
begin
  perform pg_advisory_xact_lock(hashtext('kelimekart.profiles.limit'));
  select count(*) into current_count from public.profiles;
  if current_count >= public.max_profiles() then
    raise exception 'Kullanıcı sınırına ulaşıldı (en fazla % kişi).', public.max_profiles()
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_limit
  before insert on public.profiles
  for each row execute function public.enforce_profile_limit();

-- Supabase'de kullanıcı oluşturulunca profil satırı da oluşur.
-- Sınır aşılırsa hata kullanıcı oluşturmayı da geri alır (aynı işlem).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
        'Kullanıcı'
      ),
      40
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Erişim: herkes yalnızca kendi profilini görür ve ayar alanlarını değiştirir.
-- Seri (streak) alanlarını istemci değiştiremez; onları sunucu fonksiyonları yazar.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, timezone, daily_new_limit, daily_goal_reviews)
  on public.profiles to authenticated;

create policy "profiles: kendi satırını okur"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles: kendi satırını günceller"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Tetikleyici fonksiyonları dışarıdan çağrılamaz.
revoke execute on function public.enforce_profile_limit() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
