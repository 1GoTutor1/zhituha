import { useEffect, useState } from 'react';
import { MapPinned, Navigation, CarFront, BatteryCharging, Building2, Coffee, Factory, House, RotateCcw } from 'lucide-react';

const DISTRICTS = [
  { id: 'center', name: 'Центр', subtitle: 'Деловые улицы и главные точки', icon: Building2, tone: '#f3b34c' },
  { id: 'residential', name: 'Спальный район', subtitle: 'Кварталы, сервис и повседневный спрос', icon: House, tone: '#78c7a0' },
  { id: 'factory', name: 'Заводской район', subtitle: 'Проходная, производство и рабочие смены', icon: Factory, tone: '#73b9e8' },
];

const DISTRICT_BY_LOCATION: Record<string, string> = {
  coffee_01: 'center', coffee_02: 'center', salon_high: 'center', taxi_yandex: 'center', minimarket_01: 'center', repair_01: 'center', casino_01: 'center',
  coffee_03: 'residential', coffee_04: 'residential', salon_low: 'residential', taxi_maxim: 'residential', minimarket_02: 'residential', minimarket_03: 'residential', repair_02: 'residential',
  coffee_05: 'factory', coffee_06: 'factory', salon_mid: 'factory', taxi_uber: 'factory', construction_01: 'factory', construction_02: 'factory', minimarket_04: 'factory',
};

export const districtName = (id?: string) => DISTRICTS.find((district) => district.id === id)?.name || 'Центр';

export const DistrictMapTab = ({ app }: { app: any }) => {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!app.pid) return;
    setLoading(true);
    try {
      const { data, error } = await app.supabase.rpc('district_state_rpc', { p_player_id: app.pid });
      if (!error && data && !data.error) setLocations(data.locations || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [app.pid]);

  const current = DISTRICTS.find((district) => district.id === app.currentDistrict) || DISTRICTS[0];
  const travelCost = app.hasCar ? 5 : 20;

  return <section style={{ maxWidth: 520, margin: '0 auto', display: 'grid', gap: 14, color: 'var(--text-main)' }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 14, background: 'rgba(255,153,32,.14)', color: '#ff9b24' }}><MapPinned size={23} /></div>
      <div><h1 style={{ margin: 0, fontSize: 23 }}>Районы города</h1><p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 13 }}>Бизнесы разделены по карте. Кофейни работают только в своём районе.</p></div>
    </header>

    <article style={{ padding: 16, borderRadius: 18, border: '1px solid var(--surface-line)', background: 'var(--surface-card, rgba(37,25,48,.88))' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div><small style={{ color: 'var(--text-muted)' }}>Ты сейчас в районе</small><h2 style={{ margin: '4px 0 0', fontSize: 21 }}>{current.name}</h2></div>
        <div style={{ textAlign: 'right' }}><small style={{ color: 'var(--text-muted)' }}>Энергия</small><b style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5, fontSize: 18, color: '#78d6a0' }}><BatteryCharging size={17} />{app.energy}</b></div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 13, color: 'var(--text-muted)', fontSize: 12 }}>
        {app.hasCar ? <><CarFront size={16} /> С машиной поездка стоит 5 энергии</> : <>Без машины поездка стоит 20 энергии</>}
        <button type="button" onClick={app.restForEnergy} disabled={app.proc} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, border: '1px solid var(--surface-line)', borderRadius: 10, padding: '7px 10px', color: 'var(--text-main)', background: 'var(--surface-soft)', fontWeight: 700 }}><RotateCcw size={14} /> Восстановить</button>
      </div>
    </article>

    <div style={{ display: 'grid', gap: 10 }}>
      {DISTRICTS.map((district) => {
        const Icon = district.icon;
        const active = district.id === app.currentDistrict;
        const cost = active ? 0 : travelCost;
        const districtLocations = locations.filter((location) => location.district === district.id || (!location.district && DISTRICT_BY_LOCATION[location.location_key] === district.id));
        const businessCount = districtLocations.filter((location) => location.business_id && location.status !== 'available').length;
        return <article key={district.id} style={{ padding: 14, borderRadius: 16, border: `1px solid ${active ? district.tone : 'var(--surface-line)'}`, background: active ? `linear-gradient(120deg, ${district.tone}18, var(--surface-card, rgba(37,25,48,.88)) 60%)` : 'var(--surface-card, rgba(37,25,48,.88))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', flex: '0 0 auto', borderRadius: 13, background: `${district.tone}20`, color: district.tone }}><Icon size={21} /></span>
            <div style={{ minWidth: 0, flex: 1 }}><b style={{ fontSize: 16 }}>{district.name}</b><div style={{ marginTop: 3, color: 'var(--text-muted)', fontSize: 12 }}>{district.subtitle}</div></div>
            {active ? <span style={{ color: '#7dde9e', fontSize: 12, fontWeight: 800 }}>Ты здесь</span> : <button type="button" disabled={app.proc || app.energy < cost} onClick={() => app.travelToDistrict(district.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 11, padding: '9px 11px', color: '#1c1422', background: '#ff9827', fontWeight: 800, whiteSpace: 'nowrap', opacity: app.energy < cost ? .45 : 1 }}><Navigation size={15} />Ехать · {cost}</button>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, color: 'var(--text-muted)', fontSize: 12 }}><Coffee size={14} />{districtLocations.filter((location) => location.biz_type === 'coffee').length} кофейни <span>·</span><Building2 size={14} />{districtLocations.length} точек <span>·</span>{businessCount} занято</div>
        </article>;
      })}
    </div>
    <p style={{ margin: 0, padding: '0 3px', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.45 }}>{loading ? 'Обновляю карту…' : 'Перемещение меняет твой район. Для покупки кофе в чужом районе сначала приезжай туда.'}</p>
  </section>;
};
