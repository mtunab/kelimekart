-- "Automatically expose new tables" kapalı olduğu için sunucu tarafı yönetici rolü (service_role)
-- tablolara kendiliğinden erişemiyor. Bu rol yalnızca scripts/ ve testlerde, sunucuda kullanılır.
grant select, insert, update, delete on public.profiles to service_role;

-- Bundan sonra oluşturulan tablolar ve fonksiyonlar da service_role'e açık olsun.
-- (anon ve authenticated için izinler her migration'da tek tek ve açıkça verilir.)
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
