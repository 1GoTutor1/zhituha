import { useState, useEffect } from 'react';
import { useTelegram } from './useTelegram';
import { supabase } from './supabaseClient';

const PHONE_PRICE = 2000;
const ENERGY_COOLDOWN_MS = 60000; 

interface Player {
  id: string;
  nickname: string;
  money: number;
}

interface MarketItem {
  id: string;
  seller_id: string;
  seller_name: string;
  item_type: string;
  price: number;
}

function App() {
  const { user, hapticFeedback } = useTelegram();

  const [isLoading, setIsLoading] = useState(true);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const [nickname, setNickname] = useState('');
  const [inputName, setInputName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | null>(null);

  const [money, setMoney] = useState(3500);
  const [energy, setEnergy] = useState(80);
  const [hasPhone, setHasPhone] = useState(false);

  const [timeLeft, setTimeLeft] = useState<number>(0);

  const [globalPlayers, setGlobalPlayers] = useState<Player[]>([]);
  const [marketItems, setMarketItems] = useState<MarketItem[]>([]);

  const [activeTab, setActiveTab] = useState<'home' | 'shop' | 'inventory' | 'market'>('home');
  const [notification, setNotification] = useState<string | null>(null);
  const [notifColor, setNotifColor] = useState('#10b981');

  // --- ЗАГРУЗКА ДАННЫХ ---
  const loadPlayerData = async () => {
    const tgId = user?.id?.toString() || 'test_user_123'; 

    const { data }: any = await supabase
      .from('players')
      .select('*')
      .eq('telegram_id', tgId)
      .single();

    if (data) {
      setPlayerId(data.id);
      setNickname(data.nickname);
      setGender(data.gender);
      setMoney(data.money);
      setEnergy(data.energy);
      setHasPhone(data.has_phone);
    } else if (user?.first_name) {
      setInputName(user.first_name);
    }
    setIsLoading(false);
  };

  const loadMarketData = async () => {
    // Загрузка топа
    const { data: players }: any = await supabase
      .from('players')
      .select('id, nickname, money')
      .order('money', { ascending: false })
      .limit(10);
    if (players) setGlobalPlayers(players);

    // Загрузка лотов
    const { data: lots }: any = await supabase
      .from('market_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (lots) setMarketItems(lots);
  };

  useEffect(() => {
    loadPlayerData();
  }, [user]);

  useEffect(() => {
    if (activeTab === 'market') {
      loadMarketData();
    }
  }, [activeTab]);

  const saveProgress = async (newData: Record<string, unknown>) => {
    if (!playerId) return;
    await supabase.from('players').update(newData).eq('id', playerId);
  };

  const showNotification = (message: string, isError: boolean = false) => {
    setNotification(message);
    setNotifColor(isError ? '#ef4444' : '#10b981');
    setTimeout(() => setNotification(null), 3000);
  };

  // --- ДЕЙСТВИЯ ---
  const handleRegister = async () => {
    hapticFeedback('medium');
    if (inputName.trim() === '') return showNotification('Введи никнейм!', true);
    if (!selectedGender) return showNotification('Выбери пол!', true);

    const tgId = user?.id?.toString() || 'test_user_123';

    const { data }: any = await supabase.from('players').insert([
      {
        telegram_id: tgId,
        nickname: inputName,
        gender: selectedGender,
        money: 3500,
        energy: 80,
        has_phone: false
      }
    ]).select().single();

    if (data) {
      setPlayerId(data.id);
      setNickname(inputName);
      setGender(selectedGender);
    } else {
      showNotification("Ошибка базы данных!", true);
    }
  };

  const handleWork = () => {
    hapticFeedback('medium');
    if (!hasPhone) return showNotification("Без телефона не найти работу!", true);
    if (energy < 20) return showNotification("Ты слишком устал!", true);
    
    const newMoney = money + 500;
    const newEnergy = Math.max(0, energy - 20);
    
    setMoney(newMoney);
    setEnergy(newEnergy); 
    saveProgress({ money: newMoney, energy: newEnergy });
    showNotification("Хорошая работа! +500 монет");
  };

  const handleWorkJanitor = () => {
    hapticFeedback('light');
    if (energy < 20) return showNotification("Ты слишком устал!", true);
    
    const newMoney = money + 200;
    const newEnergy = Math.max(0, energy - 20);

    setMoney(newMoney);
    setEnergy(newEnergy); 
    saveProgress({ money: newMoney, energy: newEnergy });
    showNotification("Подработка окончена. +200 монет");
  };

  const handleRest = () => {
    hapticFeedback('light');
    if (timeLeft > 0) return showNotification(`Жди ${timeLeft} сек.`, true);
    if (energy === 100) return showNotification("Полная энергия!", true);
    
    setEnergy(100);
    saveProgress({ energy: 100 });

    setTimeLeft(ENERGY_COOLDOWN_MS / 1000);
    showNotification("Энергия восстановлена!");
  };

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleBuyPhone = () => {
    hapticFeedback('heavy');
    if (money < PHONE_PRICE) return;
    
    const newMoney = money - PHONE_PRICE;
    setMoney(newMoney);
    setHasPhone(true);
    saveProgress({ money: newMoney, has_phone: true });
    showNotification("Телефон куплен!");
  };

  const handleSellPhoneToMarket = async () => {
    hapticFeedback('heavy');
    if (!hasPhone || !playerId) return;
    
    const price = prompt("За сколько монет хочешь продать телефон?", "2000");
    if (!price || isNaN(Number(price))) return;

    const { error }: any = await supabase.from('market_items').insert([{
      seller_id: playerId,
      seller_name: nickname,
      item_type: 'phone',
      price: Number(price)
    }]);

    if (!error) {
      setHasPhone(false);
      saveProgress({ has_phone: false });
      showNotification("Телефон выставлен на рынок!");
      setActiveTab('market'); // Перекидываем на рынок
      loadMarketData();
    } else {
      showNotification("Ошибка выставления лота", true);
    }
  };

  const handleBuyLot = async (lotId: string) => {
    hapticFeedback('heavy');
    
    const { data, error }: any = await supabase.rpc('buy_market_item', {
      buyer_id: playerId,
      lot_id: lotId
    });

    if (error || !data) {
      showNotification("Не хватает денег или лот продан!", true);
    } else {
      showNotification("Покупка успешна!");
      loadPlayerData(); 
      loadMarketData();
    }
  };

  // --- СТИЛИ ---
  const cardStyle = {
    backgroundColor: '#1e1e24', color: 'white', padding: 20, borderRadius: 16, 
    margin: '0 auto 20px auto', maxWidth: '350px', fontSize: 20, textAlign: 'left' as const, 
    boxShadow: '0 8px 16px rgba(0,0,0,0.4)'
  };

  if (isLoading) return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>Загрузка профиля...</div>;

  // --- ЭКРАН РЕГИСТРАЦИИ ---
  if (!nickname || !gender) {
    return (
      <div style={{ padding: 20, fontFamily: 'sans-serif', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#121212', color: 'white' }}>
        {notification && <div style={{ position: 'fixed', top: 20, backgroundColor: notifColor, padding: '15px 25px', borderRadius: '10px', fontWeight: 'bold', zIndex: 1000 }}>{notification}</div>}
        <h1>Создание персонажа</h1>
        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <button onClick={() => setSelectedGender('male')} style={{ fontSize: 40, padding: '10px 30px', cursor: 'pointer', backgroundColor: selectedGender === 'male' ? '#3b82f6' : '#1e1e24', borderRadius: 12 }}>🧑</button>
          <button onClick={() => setSelectedGender('female')} style={{ fontSize: 40, padding: '10px 30px', cursor: 'pointer', backgroundColor: selectedGender === 'female' ? '#3b82f6' : '#1e1e24', borderRadius: 12 }}>👩</button>
        </div>
        <input type="text" value={inputName} onChange={(e) => setInputName(e.target.value)} placeholder="Ник..." style={{ fontSize: 18, padding: 14, marginBottom: 20, width: '250px', borderRadius: 10, backgroundColor: '#1e1e24', color: 'white', textAlign: 'center' }} />
        <button onClick={handleRegister} style={{ fontSize: 18, padding: 15, width: '250px', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', borderRadius: 10, fontWeight: 'bold' }}>Начать</button>
      </div>
    );
  }

  // --- ОСНОВНОЙ ЭКРАН ---
  return (
    <div style={{ padding: '20px 20px 90px 20px', fontFamily: 'sans-serif', textAlign: 'center', minHeight: '100vh', backgroundColor: '#121212', color: 'white' }}>
      
      {notification && (
        <div style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', backgroundColor: notifColor, color: 'white', padding: '15px 25px', borderRadius: '10px', fontWeight: 'bold', zIndex: 1000, width: '80%', maxWidth: '300px' }}>
          {notification}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', maxWidth: '350px', margin: '0 auto', borderBottom: '1px solid #333', paddingBottom: 15, marginBottom: 20 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px', fontSize: '24px' }}>
          {user?.photo_url ? <img src={user.photo_url} alt="avatar" style={{ width: 36, height: 36, borderRadius: '50%' }} /> : <span style={{ fontSize: '28px' }}>{gender === 'male' ? '🧑' : '👩'}</span>}
          {nickname}
        </h2>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#1e1e24', padding: '15px 25px', borderRadius: '12px', maxWidth: '350px', margin: '0 auto 20px auto', border: '1px solid #333' }}>
        <div style={{ fontSize: 18 }}>💰 <b>{money}</b></div>
        <div style={{ fontSize: 18 }}>⚡ <b>{energy}</b>/100</div>
      </div>

      {/* ВКЛАДКА: ГЛАВНАЯ */}
      {activeTab === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
          <button onClick={handleWork} style={{ fontSize: 18, padding: 16, width: '320px', cursor: hasPhone ? 'pointer' : 'not-allowed', backgroundColor: hasPhone ? '#10b981' : '#333', color: hasPhone ? 'white' : '#888', borderRadius: 12, fontWeight: 'bold', border: 'none' }}>
            Работать (💰+500, ⚡-20)
          </button>
          <button onClick={handleWorkJanitor} style={{ fontSize: 18, padding: 16, width: '320px', backgroundColor: '#f59e0b', color: 'white', borderRadius: 12, fontWeight: 'bold', border: 'none' }}>
            Дворником (💰+200, ⚡-20)
          </button>
          <button onClick={handleRest} disabled={timeLeft > 0} style={{ fontSize: 18, padding: 16, width: '320px', backgroundColor: timeLeft > 0 ? '#333' : '#3b82f6', color: timeLeft > 0 ? '#888' : 'white', borderRadius: 12, fontWeight: 'bold', border: 'none' }}>
            {timeLeft > 0 ? `Ждать ${timeLeft} сек.` : 'Отдохнуть'}
          </button>
        </div>
      )}

      {/* ВКЛАДКА: МАГАЗИН */}
      {activeTab === 'shop' && (
        <div>
          <h2>🏪 Гос. магазин</h2>
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <div style={{ fontSize: 60, marginBottom: 10 }}>📱</div>
            <h3>Смартфон</h3>
            <p style={{ color: '#a1a1aa', fontSize: 16 }}>Нужен для основной работы.</p>
            {hasPhone ? <div style={{ color: '#10b981', fontWeight: 'bold' }}>✅ Куплено</div> : (
              <button onClick={handleBuyPhone} disabled={money < PHONE_PRICE} style={{ fontSize: 18, padding: 15, width: '100%', backgroundColor: money < PHONE_PRICE ? '#333' : '#8b5cf6', color: money < PHONE_PRICE ? '#888' : 'white', borderRadius: 12, fontWeight: 'bold', marginTop: 10, border: 'none' }}>
                {money < PHONE_PRICE ? 'Мало денег' : `Купить за 💰 ${PHONE_PRICE}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ВКЛАДКА: РЫНОК */}
      {activeTab === 'market' && (
        <div>
          <h2>🌍 Барахолка</h2>
          
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ color: '#a1a1aa', fontSize: 18 }}>Топ богачей</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '350px', margin: '0 auto' }}>
              {globalPlayers.map((p, index) => (
                <div key={p.id} style={{ backgroundColor: '#1e1e24', padding: '10px 15px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: 16, color: index === 0 ? '#fbbf24' : index === 1 ? '#9ca3af' : index === 2 ? '#b45309' : '#a1a1aa' }}>
                      {index + 1}.
                    </span>
                    <span style={{ fontWeight: 'bold' }}>{p.nickname}</span>
                  </div>
                  <span style={{ color: '#10b981', fontWeight: 'bold' }}>{p.money} 💰</span>
                </div>
              ))}
            </div>
          </div>

          <h3 style={{ color: '#a1a1aa', fontSize: 18 }}>Лоты игроков</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '350px', margin: '0 auto' }}>
            {marketItems.length === 0 ? <p style={{ color: '#666' }}>Пока никто ничего не продает...</p> : null}
            {marketItems.map((item) => (
              <div key={item.id} style={{ backgroundColor: '#1e1e24', padding: 15, borderRadius: 12, border: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 24 }}>📱 Смартфон</div>
                  <div style={{ fontSize: 12, color: '#a1a1aa' }}>Продавец: {item.seller_name}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                  <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{item.price} 💰</span>
                  {item.seller_id === playerId ? (
                    <span style={{ fontSize: 12, color: '#a1a1aa' }}>Ваш лот</span>
                  ) : (
                    <button onClick={() => handleBuyLot(item.id)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 'bold' }}>
                      Купить
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ВКЛАДКА: ИНВЕНТАРЬ */}
      {activeTab === 'inventory' && (
        <div>
          <h2>🎒 Инвентарь</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '350px', margin: '0 auto' }}>
            {hasPhone ? (
              <div style={{ backgroundColor: '#1e1e24', padding: 16, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #333' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ fontSize: 32 }}>📱</div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 'bold' }}>Смартфон</div>
                  </div>
                </div>
                <button onClick={handleSellPhoneToMarket} style={{ backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: 8, padding: '10px 15px', cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>
                  Продать игрокам
                </button>
              </div>
            ) : <div style={{ color: '#52525b', padding: 40 }}>Пусто...</div>}
          </div>
        </div>
      )}

      {/* НИЖНЕЕ МЕНЮ */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#1e1e24', borderTop: '1px solid #333', display: 'flex', justifyContent: 'space-around', padding: '12px 0 20px 0', zIndex: 100 }}>
        <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', fontSize: 12, color: activeTab === 'home' ? '#3b82f6' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>🏠</span> Главная
        </button>
        <button onClick={() => setActiveTab('market')} style={{ background: 'none', border: 'none', fontSize: 12, color: activeTab === 'market' ? '#3b82f6' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>🌍</span> Рынок
        </button>
        <button onClick={() => setActiveTab('shop')} style={{ background: 'none', border: 'none', fontSize: 12, color: activeTab === 'shop' ? '#3b82f6' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>🏪</span> Магазин
        </button>
        <button onClick={() => setActiveTab('inventory')} style={{ background: 'none', border: 'none', fontSize: 12, color: activeTab === 'inventory' ? '#3b82f6' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>🎒</span> Сумка
        </button>
      </div>
    </div>
  );
}

export default App;