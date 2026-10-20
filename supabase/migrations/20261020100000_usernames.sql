-- Kullanıcı adıyla giriş.
-- Supabase Auth e-posta ister; her kullanıcı adı arka planda "<ad>@users.kelimekart.invalid"
-- iç adresine eşlenir (.invalid alan adı gerçek olamaz, bu adreslere asla e-posta gitmez).
-- Kullanıcı adı profiles.username'de tutulur; görünen addan bağımsızdır ve istemci değiştiremez.

alter table public.profiles add column username text;

-- Mevcut hesaplar: e-postanın @ öncesinden türet (çakışırsa sonuna sayı ekle).
with base as (
  select p.id,
         coalesce(
           nullif(left(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9._-]', '', 'g'), 17), ''),
           'kullanici'
         ) as name
  from public.profiles p
  join auth.users u on u.id = p.id
),
numbered as (
  select id, name, row_number() over (partition by name order by id) as n from base
)
update public.profiles p
set username = case
  when numbered.n > 1 then numbered.name || numbered.n
  when length(numbered.name) < 3 then rpad(numbered.name, 3, '0') -- rpad yalnızca kısaysa (uzunu keser)
  else numbered.name
end
from numbered
where numbered.id = p.id;

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_format check (username ~ '^[a-z0-9._-]{3,20}$'),
  add constraint profiles_username_unique unique (username);

-- Yeni kullanıcı: kullanıcı adı yönetici betiğinden (user_metadata.username) gelir;
-- yoksa e-postadan türetilir, alınmışsa sonuna rastgele ek konur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text;
begin
  v_username := lower(nullif(trim(new.raw_user_meta_data ->> 'username'), ''));
  if v_username is null then
    v_username := coalesce(
      nullif(left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9._-]', '', 'g'), 20), ''),
      'kullanici'
    );
    -- 3 karakterden kısaysa tamamla (rpad uzun metni KESER; sadece kısaysa uygula).
    if length(v_username) < 3 then
      v_username := rpad(v_username, 3, '0');
    end if;
    if exists (select 1 from public.profiles where username = v_username) then
      v_username := left(v_username, 15) || '-' || substr(md5(random()::text), 1, 4);
    end if;
  end if;

  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    v_username,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        v_username
      ),
      40
    )
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
