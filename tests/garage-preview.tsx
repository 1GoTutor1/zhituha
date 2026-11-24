// Isolated real-component fixture for browser checks. No API or player data.
import { createRoot } from 'react-dom/client';
import { InventoryTab } from '../src/tabs';
import '../src/index.css';
import '../src/App.css';

const actions: unknown[] = [];
document.body.dataset.uiTheme = 'dark';
document.documentElement.dataset.uiTheme = 'dark';
Object.assign(window, { garageAuditActions: actions });
const failed = new URLSearchParams(location.search).has('error');
const models = [
  { model_id: 'bmw_5', model_name: 'BMW 5 Series', base_price: 3000000 },
  { model_id: 'mercedes_e', model_name: 'Mercedes-Benz E-Class', base_price: 4200000 },
  { model_id: 'toyota', model_name: 'Toyota Corolla', base_price: 850000 },
];
const app = new Proxy({
  proc: false, pid: 'fixture', phone: false, hasCar: true, carModel: 'bmw_5', carHealth: 42,
  hasHouse: true, houseType: 'house', money: 10000000,
  career: { inventory: [], inventory_slots: 0 }, numberCollection: { car_numbers: [], numbers: [], car_plate: 'А111АА 77' },
  vehicleState: { models, garageError: failed, garage: failed ? null : {
    garage_used: 3, garage_slots: 4,
    vehicles: models.map((model, i) => ({
      ...model, id: 'car-' + i, health: [42, 73, 15][i], plate: i === 2 ? null : 'А111АА 77',
      is_active: i === 0, is_listed: i === 2,
    })),
  } },
}, {
  get(target, key) {
    if (key in target) return Reflect.get(target, key);
    return (...args: unknown[]) => actions.push([key, ...args]);
  },
});
createRoot(document.getElementById('root')!).render(<main style={{ padding: 12, color: 'var(--text-main)' }}><InventoryTab app={app} /></main>);
