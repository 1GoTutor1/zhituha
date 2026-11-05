import { useEffect, useState } from 'react';
import { BatteryCharging, Building2, CarFront, Clock3, Factory, House, MapPinned, Navigation } from 'lucide-react';
import { Modal } from './components';
import { DISTRICTS, districtForLocation } from './districts';

export const districtName = (id?: string) => DISTRICTS.find((district) => district.id === id)?.name || 'Центр';

export const DistrictMapTab = ({ app }: { app: any }) => {
  const [locations, setLocations] = useState<any[] | null>(null);
  const [openBusinesses, setOpenBusinesses] = useState<any[] | null>(null);
  const [taxiOptions, setTaxiOptions] = useState<any[]>([]);
  const [taxiDestination, setTaxiDestination] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const [restAvailableAt, setRestAvailableAt] = useState<string | null>(null);
  const [restError, setRestError] = useState('');
  const [resting, setResting] = useState(false);

  const refresh = async () => {
    if (!app.pid) return;
    setLoading(true);
    try {
      setLoadError('');
      const { data: results, error } = await app.supabase.rpcBatch([
        { name: 'business_catalog_rpc' },
        { name: 'business_shop_state_rpc' },
        { name: 'district_taxi_options_rpc' },
        { name: 'district_rest_state_rpc' },
      ]);
      if (error) throw error;
      const [catalogResult, shopResult, taxiResult, restStateResult] = results as any[];
      if (catalogResult.error) throw catalogResult.error;
      if (catalogResult.data?.error) throw new Error(catalogResult.data.error);
      if (shopResult.error) throw shopResult.error;
      if (shopResult.data?.error) throw new Error(shopResult.data.error);
      if (!Array.isArray(catalogResult.data?.locations)) throw new Error('Каталог не вернул список точек');
      const nextLocations = catalogResult.data.locations;
      setLocations(nextLocations);
      const operational = [
        ...(shopResult.data?.shops || []).filter((shop: any) => shop.status === 'open'),
        ...(shopResult.data?.repair_shops || []).filter((shop: any) => shop.status === 'open').map((shop: any) => ({ ...shop, biz_type: 'auto_repair' })),
      ];
      setOpenBusinesses(operational.map((business: any) => {
        const point = nextLocations.find((location: any) => String(location.business_id) === String(business.business_id));
        return { ...business, location_key: point?.location_key, district: business.district || point?.district };
      }).filter((business: any) => business.location_key || business.district));
      setTaxiOptions(taxiResult.error ? [] : (taxiResult.data?.options || []));
      if (!restStateResult.error && !restStateResult.data?.error) {
        setRestAvailableAt(restStateResult.data?.available_at || null);
        setRestError('');
      } else {
        setRestError(restStateResult.error?.message || restStateResult.data?.error || 'Восстановление энергии пока не настроено');
      }
    } catch (error: any) {
      setLoadError(error?.message || 'Не удалось загрузить точки бизнеса');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [app.pid, app.currentDistrict, app.taxiRide?.id]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), app.taxiRide ? 300 : 1000);
    return () => window.clearInterval(timer);
  }, [app.taxiRide?.id, app.taxiRide?.status]);

  const current = DISTRICTS.find((district) => district.id === app.currentDistrict) || DISTRICTS[0];
  const travelCost = app.hasCar ? 5 : 20;
  const maxEnergy = app.hasHouse ? 150 : 100;
  const restSeconds = restAvailableAt ? Math.max(0, Math.ceil((new Date(restAvailableAt).getTime() - clock) / 1000)) : 0;
  const restIsReady = !restError && restSeconds === 0;
  const energyIsFull = Number(app.energy) >= maxEnergy;
  const restoreEnergy = async () => {
    if (resting || !restIsReady || energyIsFull) return;
    setResting(true);
    setRestError('');
    try {
      const { data, error } = await app.supabase.rpc('district_rest_rpc', { p_player_id: app.pid });
      if (error) throw new Error(error.message);
      if (data?.error) {
        if (data.available_at) setRestAvailableAt(data.available_at);
        app.showMsg(data.error);
        return;
      }
      if (data?.available_at) setRestAvailableAt(data.available_at);
      await app.refreshProfile();
      app.showMsg(`Восстановлено ${data.energy_restored} энергии`);
    } catch (error: any) {
      app.showMsg(error?.message || 'Не удалось восстановить энергию');
    } finally {
      setResting(false);
    }
  };
  const activeRide = app.taxiRide;
  const rideTarget = activeRide?.status === 'in_trip' ? activeRide.completes_at : activeRide?.arrives_at;
  const rideSeconds = rideTarget ? Math.max(0, Math.ceil((new Date(rideTarget).getTime() - clock) / 1000)) : 0;
  const destinationOptions = taxiOptions.filter((option) => option.district === app.currentDistrict);
  const selectedDestination = DISTRICTS.find((district) => district.id === taxiDestination);
  const classLabels: Record<string, string> = { economy: 'Эконом', comfort: 'Комфорт', business: 'Бизнес' };
  const estimateTripSeconds = (taxiClass: string) => {
    const hasCenter = app.currentDistrict === 'center' || taxiDestination === 'center';
    const routeSteps = hasCenter
      ? (app.currentDistrict === 'factory' || taxiDestination === 'factory' ? 1 : 0)
      : 2;
    const classBase = taxiClass === 'economy' ? 10 : taxiClass === 'comfort' ? 8 : 6;
    return classBase + routeSteps * 2;
  };

  return <section style={{ maxWidth: 520, margin: '0 auto', display: 'grid', gap: 14, color: 'var(--text-main)' }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 14, background: 'rgba(255,153,32,.14)', color: '#ff9b24' }}><MapPinned size={23} /></div>
      <div><h1 style={{ margin: 0, fontSize: 23 }}>Районы города</h1><p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Бизнесы разделены по карте. Кофейни работают только в своём районе.</p></div>
    </header>

    <article style={{ padding: 16, borderRadius: 18, border: '1px solid var(--surface-line)', background: 'var(--surface-card, rgba(37,25,48,.88))' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div><small style={{ color: 'var(--text-muted)' }}>Ты сейчас в районе</small><h2 style={{ margin: '4px 0 0', fontSize: 21 }}>{current.name}</h2></div>
        <div style={{ textAlign: 'right' }}><small style={{ color: 'var(--text-muted)' }}>Энергия</small><b style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, fontSize: 18, color: '#78d6a0' }}><BatteryCharging size={17} />{app.energy} / {maxEnergy}</b></div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 13, color: 'var(--text-muted)', fontSize: 12 }}>
        {app.hasCar ? <><CarFront size={16} /> С машиной поездка стоит 5 энергии</> : <>Без машины поездка стоит 20 энергии</>}
        <span style={{ marginLeft: 'auto', textAlign: 'right', color: 'var(--text-muted)' }}>Кофе восстанавливает энергию:<br /><b style={{ color: 'var(--text-main)' }}>+10 / +25 / +40</b></span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 13, paddingTop: 12, borderTop: '1px solid var(--surface-line)' }}>
        <div style={{ flex: '1 1 150px', color: 'var(--text-muted)', fontSize: 12 }}>Можно бесплатно восстановить <b style={{ color: 'var(--text-main)' }}>20 энергии</b> раз в 90 секунд.</div>
        <button type="button" disabled={resting || !restIsReady || energyIsFull} onClick={() => void restoreEnergy()} style={{ border: 0, borderRadius: 10, padding: '9px 12px', color: '#21152a', background: '#ff9827', fontWeight: 850, opacity: resting || !restIsReady || energyIsFull ? .55 : 1 }}>
          {resting ? 'Восстанавливаем…' : energyIsFull ? 'Энергия полная' : restError ? 'Недоступно' : restSeconds > 0 ? `Восстановить через ${restSeconds} сек` : 'Восстановить +20 энергии'}
        </button>
        {restError && <small role="alert" style={{ flexBasis: '100%', color: '#ff9b91' }}>{restError}</small>}
      </div>
    </article>

    {activeRide && <article role="status" style={{ padding: 15, borderRadius: 16, border: '1px solid rgba(255,153,32,.45)', background: 'linear-gradient(120deg, rgba(255,153,32,.14), var(--surface-card, rgba(37,25,48,.88)))' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><CarFront size={21} color="#ff9b24" />
        <div style={{ flex: 1 }}><b>{activeRide.status === 'in_trip' ? `Едешь на ${activeRide.car_name}` : `${activeRide.car_name} едет к тебе`}</b>
          <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 3 }}>{activeRide.status === 'in_trip' ? `До района «${districtName(activeRide.destination_district)}» · ${activeRide.fare} ₽` : `Машина будет через ${rideSeconds} сек · ${activeRide.fare} ₽`}</div></div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800 }}><Clock3 size={15} />{rideSeconds} сек</span>
      </div>
    </article>}

    <div style={{ display: 'grid', gap: 10 }}>
      {DISTRICTS.map((district) => {
        const Icon = district.id === 'center' ? Building2 : district.id === 'residential' ? House : Factory;
        const tone = district.id === 'center' ? '#f3b34c' : district.id === 'residential' ? '#78c7a0' : '#73b9e8';
        const active = district.id === app.currentDistrict;
        const cost = active ? 0 : travelCost;
        const openInDistrict = (openBusinesses || []).filter((business) => districtForLocation(business).id === district.id);
        return <article key={district.id} style={{ padding: 14, borderRadius: 16, border: `1px solid ${active ? tone : 'var(--surface-line)'}`, background: active ? `linear-gradient(120deg, ${tone}18, var(--surface-card, rgba(37,25,48,.88)) 60%)` : 'var(--surface-card, rgba(37,25,48,.88))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', flex: '0 0 auto', borderRadius: 13, background: `${tone}20`, color: tone }}><Icon size={21} /></span>
            <div style={{ minWidth: 0, flex: 1 }}><b style={{ fontSize: 16 }}>{district.name}</b><div style={{ marginTop: 3, color: 'var(--text-muted)', fontSize: 12 }}>{district.subtitle}</div></div>
            {active ? <span style={{ color: '#7dde9e', fontSize: 12, fontWeight: 800 }}>Ты здесь</span> : <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6 }}>
              <button type="button" disabled={app.proc || app.energy < cost || Boolean(activeRide)} onClick={() => app.travelToDistrict(district.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 11, padding: '9px 11px', color: '#1c1422', background: '#ff9827', fontWeight: 800, whiteSpace: 'nowrap', opacity: app.energy < cost || activeRide ? .45 : 1 }}><Navigation size={15} />Ехать · {cost}</button>
              <button type="button" disabled={app.proc || Boolean(activeRide)} onClick={() => setTaxiDestination(district.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid rgba(113,183,224,.5)', borderRadius: 11, padding: '8px 10px', color: '#b8def2', background: 'rgba(65,139,178,.16)', fontWeight: 800, whiteSpace: 'nowrap', opacity: activeRide ? .45 : 1 }}><CarFront size={15} />Такси</button>
            </div>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}><Building2 size={14} />{openBusinesses === null ? '—' : `Открыто бизнесов: ${openInDistrict.length}`}</div>
          {openInDistrict.length > 0 && <div style={{ display: 'grid', gap: 6, marginTop: 9 }}>
            {openInDistrict.map((business: any) => <div key={`${district.id}-${business.business_id}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 9, background: 'rgba(255,255,255,.035)', fontSize: 12 }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>{business.business_name || 'Бизнес'}</span>
              <span style={{ flex: '0 0 auto', color: 'var(--text-muted)' }}>{business.owner_name || 'Государство'}</span>
            </div>)}
          </div>}
        </article>;
      })}
    </div>

    <p role={loadError ? 'alert' : 'status'} style={{ margin: 0, padding: '0 3px', color: loadError ? '#ff8b83' : 'var(--text-muted)', fontSize: 12, lineHeight: 1.45 }}>{loading ? 'Обновляю карту…' : loadError ? `Не удалось обновить список открытых бизнесов: ${loadError}` : locations === null ? 'Список бизнесов ещё не загружен.' : 'Такси не тратит энергию. Цена зависит от класса машины; в пути BMW быстрее «Матиза».'}</p>

    <Modal open={Boolean(taxiDestination)} onClose={() => setTaxiDestination(null)} contentStyle={{ width: 'min(100%, 480px)', textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 5 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>Такси до района «{selectedDestination?.name}»</h2>
        <button type="button" onClick={() => setTaxiDestination(null)} aria-label="Закрыть" style={{ border: 0, borderRadius: 9, padding: '5px 10px', color: 'var(--text-main)', background: 'rgba(255,255,255,.08)', fontSize: 20 }}>×</button>
      </div>
      <p style={{ margin: '4px 0 12px', color: 'var(--text-muted)', fontSize: 13 }}>Подача — 5 секунд. Затем время зависит от машины и маршрута.</p>
      {destinationOptions.length === 0 ? <div style={{ padding: 14, borderRadius: 12, background: 'rgba(255,255,255,.05)', color: 'var(--text-muted)', lineHeight: 1.4 }}>В районе «{current.name}» сейчас нет свободных такси с водителем. Попробуй позже или выбери обычную поездку.</div>
        : <div style={{ display: 'grid', gap: 9, maxHeight: '55vh', overflowY: 'auto' }}>{destinationOptions.map((option) => {
          const sampleCars = (option.cars || []).map((car: any) => car.model_name).filter(Boolean).slice(0, 2).join(', ');
          return <article key={`${option.business_id}-${option.taxi_class}`} style={{ padding: 12, border: '1px solid var(--surface-line)', borderRadius: 13, background: 'rgba(255,255,255,.035)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}><div><b>{classLabels[option.taxi_class] || 'Такси'} · {option.business_name}</b><div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>{sampleCars || 'Машина таксопарка'} · свободно машин: {option.cars?.length || 0}</div><div style={{ marginTop: 4, color: 'var(--text-muted)', fontSize: 12 }}>Подача 5 сек + поездка {estimateTripSeconds(option.taxi_class)} сек</div></div><b style={{ whiteSpace: 'nowrap' }}>{option.fare} ₽</b></div>
            <button type="button" disabled={app.proc} onClick={() => { const destination = taxiDestination; setTaxiDestination(null); if (destination) app.requestTaxiRide(destination, option.business_id, option.taxi_class); }} style={{ width: '100%', marginTop: 10, padding: '10px 12px', border: 0, borderRadius: 10, background: '#ff9827', color: '#21152a', fontWeight: 900 }}>Заказать · {option.fare} ₽</button>
          </article>;
        })}</div>}
    </Modal>
  </section>;
};
