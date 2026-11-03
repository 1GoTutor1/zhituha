-- Prevent a business under lease-to-own from being used as bank collateral.
-- Apply after BANK_BUSINESS_COLLATERAL_MIGRATION.sql and BUSINESS_LEASE_TO_OWN_MIGRATION.sql.

create or replace function public.bank_validate_business_collateral()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.collateral_type <> 'business' or new.collateral_business_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.businesses b
    where b.id = new.collateral_business_id
      and b.owner_id = new.player_id
  ) then
    raise exception 'Выбранный бизнес не принадлежит заёмщику';
  end if;

  if exists (
    select 1
    from public.business_locations bl
    where bl.business_id = new.collateral_business_id
      and coalesce((to_jsonb(bl)->>'lease_active')::boolean, false)
  ) then
    raise exception 'Бизнес в аренде с выкупом нельзя закладывать';
  end if;

  if exists (
    select 1
    from public.bank_loans l
    where l.collateral_business_id = new.collateral_business_id
      and l.status in ('active', 'foreclosed')
      and l.amount_due > 0
  ) then
    raise exception 'Этот бизнес уже находится в залоге';
  end if;

  return new;
end;
$$;

drop trigger if exists bank_validate_business_collateral on public.bank_loans;
create trigger bank_validate_business_collateral
before insert or update of collateral_type, collateral_business_id, player_id
on public.bank_loans
for each row execute function public.bank_validate_business_collateral();

revoke all on function public.bank_validate_business_collateral() from public, anon, authenticated;

notify pgrst, 'reload schema';
