-- Grup sınırı 5 → 20 kişi. Sınırın tanımlandığı tek yer `max_profiles()`; tetikleyici bunu okur.
-- (Yetkiler `create or replace` ile korunur.)
create or replace function public.max_profiles()
returns integer
language sql
immutable
set search_path = ''
as $$ select 20 $$;
