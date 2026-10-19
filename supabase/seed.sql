-- SADECE DEV: örnek deste. `pnpm db:seed` ile uygulanır (prod'da çalıştırılması betik tarafından engellenir).
-- Tekrar çalıştırılabilir: deste zaten varsa bir şey yapmaz. Test kullanıcılarına (kk-test-) dokunmaz.
do $$
declare
  v_owner uuid;
  v_deck uuid;
begin
  select p.id into v_owner
  from public.profiles p
  join auth.users u on u.id = p.id
  where u.email not like 'kk-test-%'
  order by p.created_at
  limit 1;

  if v_owner is null then
    raise notice 'Örnek veri atlandı: önce pnpm invite ile bir kullanıcı ekle.';
    return;
  end if;

  if exists (select 1 from public.decks where owner_id = v_owner and name = 'Örnek: Temel İngilizce') then
    raise notice 'Örnek deste zaten var.';
    return;
  end if;

  insert into public.decks (name, source_lang, target_lang, owner_id)
  values ('Örnek: Temel İngilizce', 'en', 'tr', v_owner)
  returning id into v_deck;
  insert into public.deck_members (deck_id, user_id, role) values (v_deck, v_owner, 'owner');

  insert into public.cards (deck_id, front, back, example, tags, created_by) values
    (v_deck, 'apple', 'elma', 'I eat an apple every day.', '{meyve,A1}', v_owner),
    (v_deck, 'book', 'kitap', 'This book is interesting.', '{A1}', v_owner),
    (v_deck, 'to borrow', 'ödünç almak', 'Can I borrow your pen?', '{fiil,A2}', v_owner),
    (v_deck, 'to lend', 'ödünç vermek', 'She lent me her car.', '{fiil,A2}', v_owner),
    (v_deck, 'reliable', 'güvenilir', 'He is a reliable friend.', '{sıfat,B1}', v_owner),
    (v_deck, 'to achieve', 'başarmak', 'You can achieve your goals.', '{fiil,B1}', v_owner),
    (v_deck, 'although', 'rağmen, -e karşın', 'Although it rained, we went out.', '{bağlaç,B1}', v_owner),
    (v_deck, 'to improve', 'geliştirmek', 'I want to improve my English.', '{fiil,A2}', v_owner),
    (v_deck, 'opportunity', 'fırsat', 'This is a great opportunity.', '{isim,B1}', v_owner),
    (v_deck, 'to suggest', 'önermek', 'I suggest we leave early.', '{fiil,B1}', v_owner),
    (v_deck, 'weather', 'hava (durumu)', 'The weather is nice today.', '{isim,A1}', v_owner),
    (v_deck, 'to decide', 'karar vermek', 'We decided to stay.', '{fiil,A2}', v_owner);
end;
$$;
