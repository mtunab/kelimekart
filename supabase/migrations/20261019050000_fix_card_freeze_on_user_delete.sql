-- Düzeltme: kullanıcı silinince kartlarının created_by alanı NULL'a çekilir (ON DELETE SET NULL).
-- Eski koruma bunu da "oluşturanı değiştirme" sayıp kullanıcı silmeyi engelliyordu.
-- Yeni kural: deste değiştirilemez; oluşturan başka birine değiştirilemez, sadece boşaltılabilir.
create or replace function public.cards_freeze_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.deck_id <> old.deck_id
     or (new.created_by is not null and new.created_by is distinct from old.created_by) then
    raise exception 'Kartın destesi veya oluşturanı değiştirilemez.' using errcode = '42501';
  end if;
  return new;
end;
$$;
