export const DISTRICTS = [
  { id: 'center', name: 'Центр', subtitle: 'Деловые улицы и главные точки' },
  { id: 'residential', name: 'Спальный район', subtitle: 'Кварталы, сервис и повседневный спрос' },
  { id: 'factory', name: 'Заводской район', subtitle: 'Проходная, производство и рабочие смены' },
] as const;

export type DistrictId = typeof DISTRICTS[number]['id'];

export const DISTRICT_BY_LOCATION: Record<string, DistrictId> = {
  coffee_01: 'center', coffee_02: 'center', salon_high: 'center', taxi_yandex: 'center', minimarket_01: 'center', repair_01: 'center', casino_01: 'center',
  coffee_03: 'residential', coffee_04: 'residential', salon_low: 'residential', taxi_maxim: 'residential', minimarket_02: 'residential', minimarket_03: 'residential', repair_02: 'residential',
  coffee_05: 'factory', coffee_06: 'factory', salon_mid: 'factory', taxi_uber: 'factory', construction_01: 'factory', construction_02: 'factory', minimarket_04: 'factory',
  coffee_07: 'factory', minimarket_05: 'residential',
};

export const RETIRED_LOCATION_KEYS = new Set(['coffee_07', 'minimarket_05']);

export const districtForLocation = (location: { district?: string | null; location_key?: string }) => {
  const districtId = location.district || DISTRICT_BY_LOCATION[location.location_key || ''];
  return DISTRICTS.find((district) => district.id === districtId) || DISTRICTS[0];
};
