import { useEffect, useState } from 'react';
import { MapPinned, Navigation, CarFront, BatteryCharging, Building2, Factory, House } from 'lucide-react';
import { DISTRICTS, districtForLocation } from './districts';

export const districtName = (id?: string) => DISTRICTS.find((district) => district.id === id)?.name || 'Центр';

export const DistrictMapTab = ({ app }: { app: any }) => {
  const [locations, setLocations] = useState<any[] | null>(null);
  const [openBusinesses, setOpenBusinesses] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const refresh = async () => {
    if (!app.pid) return;
    setLoading(true);
    try {
      setLoadError('');
      const [catalogResult, shopResult] = await Promise.all([
        app.supabase.rpc('business_catalog_rpc', { p_player_id: app.pid }),
        app.supabase.rpc('business_shop_state_rpc', { p_player_id: app.pid }),
      ]);
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
    } catch (error: any) {
      setLoadError(error?.message || 'Не удалось загрузить точки бизнеса');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [app.pid]);

  const current = DISTRICTS.find((district) => district.id === app.currentDistrict) || DISTRICTS[0];
  const travelCost = app.hasCar ? 5 : 20;
  const maxEnergy = app.hasHouse ? 150 : 100;

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
    </article>

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
            {active ? <span style={{ color: '#7dde9e', fontSize: 12, fontWeight: 800 }}>Ты здесь</span> : <button type="button" disabled={app.proc || app.energy < cost} onClick={() => app.travelToDistrict(district.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 11, padding: '9px 11px', color: '#1c1422', background: '#ff9827', fontWeight: 800, whiteSpace: 'nowrap', opacity: app.energy < cost ? .45 : 1 }}><Navigation size={15} />Ехать · {cost}</button>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}><Building2 size={14} />{openBusinesses === null ? '—' : `Открыто бизнесов: ${openInDistrict.length}`}</div>
        </article>;
      })}
    </div>
    <p role={loadError ? 'alert' : 'status'} style={{ margin: 0, padding: '0 3px', color: loadError ? '#ff8b83' : 'var(--text-muted)', fontSize: 12, lineHeight: 1.45 }}>{loading ? 'Обновляю карту…' : loadError ? `Не удалось обновить список открытых бизнесов: ${loadError}` : locations === null ? 'Список бизнесов ещё не загружен.' : 'Перемещение меняет твой район. Для покупки кофе в чужом районе сначала приезжай туда.'}</p>
  </section>;
};
