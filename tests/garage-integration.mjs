import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

// Real Postgres engine in memory: no network or production writes.
const db = new PGlite();
let checks = 0;
const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const L = '00000000-0000-4000-8000-000000000003';
const q = async (sql, args = []) => (await db.query(sql, args)).rows;
const rpc = async (name, args) => (await q('select public.' + name + '(' + args.map((_,i)=>'$'+(i+1)).join(',') + ') as result', args))[0].result;
const state = id => rpc('player_garage_state_rpc',[id]);
const player = async id => (await q('select * from players where id=$1',[id]))[0];
const ok = (condition, message) => { assert.ok(condition, message); checks++; };
const success = value => { assert.equal(value.success,true,JSON.stringify(value)); checks++; };
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private;
    create table players(id uuid primary key, nickname text default 'Player',telegram_id text default 'fixture',money bigint default 10000000,
      energy integer default 80,has_car boolean default false,car_model text default 'none',car_health smallint default 100,
      car_plate text,has_house boolean default false,house_type text default 'none',phone_count integer default 0,market_slots integer default 30);
    create table business_vehicle_catalog(model_id text primary key,model_name text,base_price bigint,salon_class text);
    create table businesses(id uuid primary key default gen_random_uuid(),owner_id uuid,biz_type text,stock jsonb default '{}',
      location_key text,created_at timestamptz default now(),cash_balance bigint default 0);
    create table business_workers(business_id uuid,player_id uuid,role text);
    create table market_items(id uuid primary key default gen_random_uuid(),seller_id uuid references players,seller_name text,
      item_type text,item_data text,price bigint,source_business_id uuid,created_at timestamptz default clock_timestamp());
    create table private.market_personal_car_snapshots(market_item_id uuid primary key references market_items on delete cascade,
      player_id uuid,car_health smallint,car_plate text);
    create table player_car_numbers(id uuid primary key default gen_random_uuid(),player_id uuid,plate text unique,estimated_value bigint,created_at timestamptz default now());
    create table season_pass_seasons(season_no integer primary key,ends_at timestamptz);
    create table player_forever_car_numbers(plate text primary key,player_id uuid,estimated_value bigint,earned_at timestamptz default now());
    create table player_car_plate_rolls(plate text,status text);
    create table bank_loans(player_id uuid,status text,collateral_type text,amount_due bigint);
    create table action_logs(player_id uuid,action_type text,details jsonb,money_delta integer,money_after integer,created_at timestamptz default now());
    create function car_plate_value(text) returns bigint language sql as $$ select 1000::bigint $$;
    create function change_stats(uuid,bigint,integer) returns void language sql as $$ update players set money=money+$2 where id=$1 $$;
    create function reset_game_rpc(p_admin_id uuid) returns jsonb language plpgsql set search_path=public as $$
    begin update players set has_car=false,car_model='none',has_house=false,house_type='none' where id=p_admin_id;
      return '{"success":true}'::jsonb; end $$;
    create function admin_reset_player_rpc(p_admin_id uuid,p_target_player_id uuid) returns jsonb language sql as $$ select public.reset_game_rpc(p_target_player_id) $$;
    create function generate_number_case_plate(text) returns text language plpgsql as $$ begin return public.generate_car_plate(); end $$;
  `);
  await db.exec(await readFile(new URL('./fixtures/garage-legacy-functions.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('./fixtures/garage-money-audit.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/20261112123518_season_end_number_snapshots.sql',import.meta.url),'utf8'));
  await db.exec(`
    create trigger players_ensure_car_plate_update before update of has_car,car_model on players for each row execute function ensure_personal_car_plate();
    create trigger players_reset_car_condition before update of has_car,car_model on players for each row execute function reset_personal_car_condition();
    create trigger players_archive_previous_car_plate after update of has_car,car_model,car_plate on players for each row execute function archive_previous_car_plate();
    create trigger players_audit_money after update of money on players for each row execute function audit_player_money_change();
    insert into business_vehicle_catalog values ('lada','Oka',35000,'low'),('toyota','Corolla',850000,'mid');
    insert into players(id,has_car,car_model,car_health,car_plate,has_house,house_type)
    values ('${A}',true,'lada',42,'A111AA 77',true,'apartment'),('${B}',true,'toyota',17,'B222BB 77',true,'penthouse');
    insert into market_items(id,seller_id,item_type,item_data,price) values ('${L}','${A}','car','personal:lada',100);
    insert into private.market_personal_car_snapshots values ('${L}','${A}',15,'C333CC 77');
    insert into player_car_numbers(player_id,plate,estimated_value) values ('${A}','C333CC 77',1000),('${A}','A111AA 77',1000);
  `);
  await db.exec(await readFile(new URL('../supabase/migrations/20261120060625_vehicles_housing_rework.sql',import.meta.url),'utf8'));
  let garage=await state(A);
  ok(garage.vehicles.length===2 && garage.garage_used===2,'legacy duplicate vehicles preserved individually');
  ok(garage.vehicles.find(v=>v.is_active).health===42,'migration keeps active car condition');
  success(await rpc('cancel_lot_rpc',[A,L,true]));
  garage=await state(A);
  ok(garage.vehicles.length===2 && garage.vehicles.filter(v=>v.is_active).length===1,'cancel returns to parking without replacing active car');
  const parked=garage.vehicles.find(v=>!v.is_active);
  success(await rpc('garage_set_active_rpc',[A,parked.id]));
  let p=await player(A);
  ok(p.car_plate==='C333CC 77' && p.car_health===15,'switch preserves plate and wear');
  ok((await q('select * from player_car_numbers where plate=$1',['A111AA 77'])).length===0,'parked plate cannot be sold as a spare');
  success(await rpc('garage_set_active_rpc',[A,(await state(A)).vehicles.find(v=>!v.is_active).id]));
  p=await player(A);
  ok(p.car_health===42 && p.car_plate==='A111AA 77','switch back never heals or rerolls');
  ok((await rpc('garage_set_active_rpc',[B,parked.id])).error,'cannot select another player vehicle');
  ok((await rpc('list_item_rpc',[A,'car','toyota',100,'personal',0])).error,'cannot forge a more expensive model');
  ok((await rpc('list_item_rpc',[A,'house','apartment',100,'personal',0])).error,'cannot sell home with multiple cars');
  success(await rpc('home_upgrade_rpc',[A,'house']));
  const afterUpgrade=(await player(A)).money;
  ok((await rpc('home_upgrade_rpc',[A,'house'])).error && (await player(A)).money===afterUpgrade,'retry never charges twice');
  ok((await state(A)).garage_slots===4,'house grants four slots');
  success(await rpc('list_item_rpc',[B,'car','toyota',100,'personal',0]));
  let lot=(await q("select id from market_items where seller_id=$1 and item_type='car'",[B]))[0].id;
  const listedVehicle=(await state(B)).vehicles[0];
  ok((await rpc('garage_set_active_rpc',[B,listedVehicle.id])).error,'listed vehicle cannot be used');
  const beforeFailure=await player(A);
  await q('update players set money=0 where id=$1',[A]);
  ok((await rpc('buy_market_item',[A,lot,5])).error,'purchase rejects insufficient balance');
  p=await player(A);
  ok(p.has_car && p.car_plate===beforeFailure.car_plate && p.car_health===42,'failed purchase restores car and plate');
  ok((await state(A)).garage_used===2,'failed purchase leaves garage unchanged');
  await q('update players set money=$2 where id=$1',[A,beforeFailure.money]);
  success(await rpc('buy_market_item',[A,lot,5]));
  ok((await q("select details->>'source_function' as source from action_logs where player_id=$1 and money_delta=95",[B]))[0]?.source==='buy_market_item','sale receipt audit survives RPC wrapping');
  ok((await player(A)).car_health===17,'buying a used car does not repair it');
  ok((await state(A)).garage_used===3 && (await state(B)).garage_used===0,'purchase transfers ownership once');
  const beforeRepeat=(await player(A)).money;
  ok((await rpc('buy_market_item',[A,lot,5])).error && (await player(A)).money===beforeRepeat,'repeat purchase cannot charge or duplicate');
  const active=(await state(A)).vehicles.find(v=>v.is_active);
  await q("insert into bank_loans values ($1,'active','car',1000)",[A]);
  ok((await rpc('garage_set_active_rpc',[A,parked.id])).error,'cannot replace loan collateral');
  ok((await rpc('list_item_rpc',[A,'car',active.model_id,100,'personal',0])).error,'cannot sell collateral');
  await q('delete from bank_loans where player_id=$1',[A]);
  await q("update players set has_car=false,car_model='none' where id=$1",[A]);
  ok(!(await state(A)).vehicles.some(v=>v.id===active.id),'foreclosed vehicle cannot be resurrected');
  success(await rpc('garage_set_active_rpc',[A,parked.id]));
  await q('update players set car_health=73 where id=$1',[A]);
  ok((await state(A)).vehicles.find(v=>v.is_active).health===73,'repair/travel condition updates sync to garage');
  await q("update players set car_plate='X444XX 77' where id=$1",[A]);
  ok((await state(A)).vehicles.find(v=>v.is_active).plate==='X444XX 77','number change updates the active instance');
  await q("insert into bank_loans values ($1,'active','house',1000)",[A]);
  ok((await rpc('home_upgrade_rpc',[A,'penthouse'])).error,'cannot upgrade pledged home');
  await q('delete from bank_loans where player_id=$1',[A]);
  success(await rpc('list_item_rpc',[B,'house','penthouse',100,'personal',0]));
  lot=(await q("select id from market_items where seller_id=$1 and item_type='house'",[B]))[0].id;
  const C='00000000-0000-4000-8000-000000000004';
  await q('insert into players(id) values ($1)',[C]);
  success(await rpc('buy_market_item',[C,lot,5]));
  ok((await player(C)).house_type==='penthouse' && (await state(C)).garage_slots===6,'upgraded home can be sold and bought');
  success(await rpc('list_item_rpc',[C,'house','penthouse',100,'personal',0]));
  lot=(await q("select id from market_items where seller_id=$1 and item_type='house'",[C]))[0].id;
  success(await rpc('cancel_lot_rpc',[C,lot,true]));
  ok((await player(C)).house_type==='penthouse','home cancellation retains upgrade');
  // Sell the old number before cancelling its car: never reclaim the buyer's number.
  success(await rpc('list_item_rpc',[A,'car','lada',100,'personal',0]));
  lot=(await q("select id from market_items where seller_id=$1 and item_type='car'",[A]))[0].id;
  await q("update player_car_numbers set player_id=$1 where plate='X444XX 77'",[B]);
  success(await rpc('cancel_lot_rpc',[A,lot,true]));
  p=await player(A);
  ok(p.has_car && p.car_health===73 && p.car_plate!=='X444XX 77','cancel into empty active slot preserves wear and allocates a new plate');
  ok((await q("select player_id from player_car_numbers where plate='X444XX 77'"))[0].player_id===B,'sold number stays with its buyer');
  // A smaller home after foreclosure preserves cars but blocks new purchases.
  await q("update players set has_house=false,house_type='none' where id=$1",[A]);
  success(await rpc('list_item_rpc',[A,'car','lada',100,'personal',0]));
  lot=(await q("select id from market_items where seller_id=$1 and item_type='car'",[A]))[0].id;
  success(await rpc('cancel_lot_rpc',[A,lot,true]));
  ok((await state(A)).garage_used===2 && (await state(A)).garage_slots===1,'capacity loss does not destroy cars or block reserved returns');
  await q("insert into businesses(owner_id,biz_type,stock) values ($1,'salon','{\"lada\":2}')",[B]);
  success(await rpc('list_item_rpc',[B,'car','lada',35000,'stock',0]));
  lot=(await q("select id from market_items where seller_id=$1 and item_data='stock:lada'",[B]))[0].id;
  const beforeFull=(await player(A)).money;
  ok((await rpc('buy_market_item',[A,lot,5])).error && (await player(A)).money===beforeFull,'full garage rejects purchase without charging');
  success(await rpc('cancel_lot_rpc',[B,lot,true]));
  ok(!(await player(B)).has_car,'stock cancellation never gives a personal car');
  ok((await q("select stock->>'lada' as quantity from businesses where owner_id=$1",[B]))[0].quantity==='2','stock cancellation restores dealership quantity');
  await q('update players set money=0 where id=$1',[C]);
  ok((await rpc('home_upgrade_rpc',[C,'house'])).error,'invalid upgrade never changes existing penthouse');
  // Force old generators to collide once: both public generators must skip parked plates.
  const reserved=(await state(A)).vehicles.find(v=>!v.is_active).plate;
  await db.exec("create sequence fixture_plate_sequence");
  await q("create table fixture_reserved(plate text)");
  await q("insert into fixture_reserved values ($1)",[reserved]);
  await db.exec(`
    create or replace function generate_car_plate_before_garage() returns text language sql as $$
      select case when nextval('public.fixture_plate_sequence')=1 then (select plate from public.fixture_reserved) else 'Z555ZZ 77' end
    $$;
  `);
  ok((await q("select generate_car_plate() as plate"))[0].plate==='Z555ZZ 77','generator skips parked numbers');
  await db.exec("create or replace function car_plate_value(text) returns bigint language sql as $$ select 30000::bigint $$");
  await db.exec("insert into season_pass_seasons(season_no,ends_at) values (1,now()-interval '1 minute')");
  await q('select number_case_finalize_expired_seasons()');
  ok((await q('select plate from player_forever_car_numbers where plate=$1 and player_id=$2',[reserved,A])).length===1,'season collection includes parked vehicle numbers');
  success(await rpc('admin_reset_player_rpc',[B,A]));
  ok((await state(A)).garage_used===0,'reset clears parked vehicles');
  ok(!(await rpc('garage_set_active_rpc',[A,parked.id])).success,'reset vehicle cannot be recovered');
  ok((await q("select has_function_privilege('anon','public.garage_set_active_rpc(uuid,uuid)','execute') as allowed"))[0].allowed===false,'anonymous mutation denied');
  ok((await q("select has_table_privilege('authenticated','public.player_garage_vehicles','select') as allowed"))[0].allowed===false,'garage table not publicly readable');
  console.log('Garage integration: '+checks+' assertions passed');
} catch (error) {
  console.error(error.message, error.detail || '', error.where || '');
  process.exitCode = 1;
} finally {
  await db.close();
}
