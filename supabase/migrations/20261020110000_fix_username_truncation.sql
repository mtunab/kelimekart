-- Düzeltme: önceki sürümde rpad(ad, 3, '0') uzun kullanıcı adlarını 3 karaktere KESİYORDU
-- (ör. "ornekkullanici12" → "orn"). Yönetici komutuyla açılan hesaplar etkilenmedi (ad metadata'dan gelir).

-- 1) Tetikleyiciyi doğru haliyle yeniden kur.
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
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), v_username), 40)
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- 2) Kesilmiş adları onar: ad, e-postadan türetilen adın ilk 3 harfiyse ve tam hali boştaysa.
with derived as (
  select p.id, p.username,
         left(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9._-]', '', 'g'), 20) as full_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email not like '%@users.kelimekart.invalid'
)
update public.profiles p
set username = d.full_name
from derived d
where d.id = p.id
  and length(d.full_name) > 3
  and p.username = left(d.full_name, 3)
  and d.full_name ~ '^[a-z0-9._-]{3,20}$'
  and not exists (select 1 from public.profiles x where x.username = d.full_name);
