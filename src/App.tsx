import { useState, useEffect } from 'react';
import { useTelegram } from './useTelegram';

// Цены и константы
const PHONE_PRICE = 2000;
const SELL_MULTIPLIER = 0.75;
const ENERGY_COOLDOWN_MS = 60000; 

// Константы бизнеса
const SHOP_PRICE = 5000; // Цена открытия магазина
const SHOP_BASE_INCOME = 300; // Доход в день
const WORKER_SALARY = 100; // Зарплата наемного NPC

function App() {
  const { user, hapticFeedback } = useTelegram();

  const [nickname, setNickname] = useState('');
  const [inputName, setInputName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | null>(null);
  const [selectedGender, setSelectedGender] = useState<'male' | 'female' | null>(null);

  // Игрок
  const [money, setMoney] = useState(3500);
  const [energy, setEnergy] = useState(80);
  const [hasPhone, setHasPhone] = useState(false);

  // Бизнес
  const [hasShop, setHasShop] = useState(false);
  const [hasWorker, setHasWorker] = useState(false);
  const [uncollectedIncome, setUncollectedIncome] = useState(0);

  // Кулдаун отдыха
  const [cooldownEnd, setCooldownEnd] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Навигация
  const [activeTab, setActiveTab] = useState<'home' | 'shop' | 'business' | 'inventory'>('home');
  
  const [notification, setNotification] = useState<string | null>(null);
  const [notifColor, setNotifColor] = useState('#10b981');

  useEffect(() => {
    if (user?.first_name && !inputName) setInputName(user.first_name);
  }, [user]);

  useEffect(() => {
    const savedName = localStorage.getItem('zhituha_nickname');
    const savedGender = localStorage.getItem('zhituha_gender') as 'male' | 'female' | null;
    const savedMoney = localStorage.getItem('zhituha_money');
    const savedEnergy = localStorage.getItem('zhituha_energy');
    const savedPhone = localStorage.getItem('zhituha_phone');
    const savedCd = localStorage.getItem('zhituha_energy_cd');
    
    // Загрузка бизнеса
    const savedShop = localStorage.getItem('zhituha_has_shop');
    const savedWorker = localStorage.getItem('zhituha_has_worker');
    const savedIncome = localStorage.getItem('zhituha_uncollected_income');

    if (savedName) setNickname(savedName);
    if (savedGender) setGender(savedGender);
    if (savedMoney) setMoney(Number(savedMoney));
    if (savedEnergy) setEnergy(Number(savedEnergy));
    if (savedPhone === 'true') setHasPhone(true);
    if (savedCd) setCooldownEnd(Number(savedCd));
    
    if (savedShop === 'true') setHasShop(true);
    if (savedWorker === 'true') setHasWorker(true);
    if (savedIncome) setUncollectedIncome(Number(savedIncome));
  }, []);

  // Сохранение прогресса
  useEffect(() => {
    if (nickname) {
      localStorage.setItem('zhituha_money', money.toString());
      localStorage.setItem('zhituha_energy', energy.toString());
      localStorage.setItem('zhituha_phone', hasPhone.toString());
      localStorage.setItem('zhituha_has_shop', hasShop.toString());
      localStorage.setItem('zhituha_has_worker', hasWorker.toString());
      localStorage.setItem('zhituha_uncollected_income', uncollectedIncome.toString());
    }
  }, [money, energy, hasPhone, hasShop, hasWorker, uncollectedIncome, nickname]);

  // Таймер кулдауна
  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.ceil((cooldownEnd - now) / 1000));
      setTimeLeft(diff);
    };
    updateTimer(); 
    const interval = setInterval(updateTimer, 1000); 
    return () => clearInterval(interval);
  }, [cooldownEnd]);

  // Пассивный доход бизнеса (добавляется раз в 10 секунд для теста)
  useEffect(() => {
    if (hasShop) {
      const interval = setInterval(() => {
        setUncollectedIncome(prev => prev + (hasWorker ? SHOP_BASE_INCOME : SHOP_BASE_INCOME / 2));
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [hasShop, hasWorker]);

  const showNotification = (message: string, isError: boolean = false) => {
    setNotification(message);
    setNotifColor(isError ? '#ef4444' : '#10b981');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleRegister = () => {
    hapticFeedback('medium');
    if (inputName.trim() === '') return showNotification('Введи никнейм!', true);
    if (!selectedGender) return showNotification('Выбери пол!', true);
    localStorage.setItem('zhituha_nickname', inputName);
    localStorage.setItem('zhituha_gender', selectedGender);
    setNickname(inputName);
    setGender(selectedGender);
  };

  // --- ДЕЙСТВИЯ ---
  const handleWork = () => {
    hapticFeedback('medium');
    if (!hasPhone) return showNotification("Без телефона не найти работу!", true);
    if (energy < 20) return showNotification("Ты слишком устал!", true);
    setMoney(money + 500);
    setEnergy(Math.max(0, energy - 20)); 
    showNotification("Хорошая работа! +500 монет");
  };

  const handleWorkJanitor = () => {
    hapticFeedback('light');
    if (energy < 20) return showNotification("Ты слишком устал!", true);
    setMoney(money + 200);
    setEnergy(Math.max(0, energy - 20)); 
    showNotification("Подработка окончена. +200 монет");
  };

  const handleRest = () => {
    hapticFeedback('light');
    if (timeLeft > 0) return showNotification(`Жди ${timeLeft} сек.`, true);
    if (energy === 100) return showNotification("Полная энергия!", true);
    setEnergy(100);
    const newCooldownEnd = Date.now() + ENERGY_COOLDOWN_MS;
    setCooldownEnd(newCooldownEnd);
    localStorage.setItem('zhituha_energy_cd', newCooldownEnd.toString());
    showNotification("Энергия восстановлена!");
  };

  const handleBuyPhone = () => {
    hapticFeedback('heavy');
    if (money < PHONE_PRICE) return;
    setMoney(money - PHONE_PRICE);
    setHasPhone(true);
    showNotification("Телефон куплен!");
  };

  const handleSellPhone = () => {
    hapticFeedback('heavy');
    if (!hasPhone) return;
    setMoney(money + Math.floor(PHONE_PRICE * SELL_MULTIPLIER));
    setHasPhone(false); 
    showNotification(`Телефон продан.`);
  };

  // --- БИЗНЕС ---
  const handleBuyShop = () => {
    hapticFeedback('heavy');
    if (money < SHOP_PRICE) return showNotification("Не хватает денег на бизнес!", true);
    setMoney(money - SHOP_PRICE);
    setHasShop(true);
    showNotification("Поздравляем! Ты открыл магазин техники.");
  };

  const handleHireWorker = () => {
    hapticFeedback('medium');
    if (money < WORKER_SALARY) return showNotification("Не хватает на зарплату!", true);
    setMoney(money - WORKER_SALARY);
    setHasWorker(true);
    showNotification("Ты нанял продавца (NPC). Доход увеличен!");
  };

  const handleCollectIncome = () => {
    hapticFeedback('medium');
    if (uncollectedIncome <= 0) return showNotification("Пока нечего собирать.", true);
    
    // Если есть рабочий, мы платим ему 30% от собранного
    const workerCut = hasWorker ? Math.floor(uncollectedIncome * 0.3) : 0;
    const playerIncome = uncollectedIncome - workerCut;
    
    setMoney(money + playerIncome);
    setUncollectedIncome(0);
    showNotification(`Собрано ${playerIncome} монет. ${workerCut > 0 ? `Рабочему отдано ${workerCut}.` : ''}`);
  };

  const cardStyle = {
    backgroundColor: '#1e1e24', color: 'white', padding: 20, borderRadius: 16, 
    margin: '0 auto 20px auto', maxWidth: '350px', fontSize: 20, textAlign: 'left' as const, 
    boxShadow: '0 8px 16px rgba(0,0,0,0.4)'
  };

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

      {/* ГЛАВНАЯ */}
      {activeTab === 'home' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
          <button onClick={handleWork} style={{ fontSize: 18, padding: 16, width: '320px', cursor: hasPhone ? 'pointer' : 'not-allowed', backgroundColor: hasPhone ? '#10b981' : '#333', color: hasPhone ? 'white' : '#888', borderRadius: 12, fontWeight: 'bold' }}>
            Работать (💰+500, ⚡-20)
          </button>
          <button onClick={handleWorkJanitor} style={{ fontSize: 18, padding: 16, width: '320px', backgroundColor: '#f59e0b', color: 'white', borderRadius: 12, fontWeight: 'bold' }}>
            Дворником (💰+200, ⚡-20)
          </button>
          <button onClick={handleRest} disabled={timeLeft > 0} style={{ fontSize: 18, padding: 16, width: '320px', backgroundColor: timeLeft > 0 ? '#333' : '#3b82f6', color: timeLeft > 0 ? '#888' : 'white', borderRadius: 12, fontWeight: 'bold' }}>
            {timeLeft > 0 ? `Ждать ${timeLeft} сек.` : 'Отдохнуть'}
          </button>
        </div>
      )}

      {/* БИЗНЕС (НОВОЕ) */}
      {activeTab === 'business' && (
        <div>
          <h2>🏢 Твой Бизнес</h2>
          {!hasShop ? (
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <div style={{ fontSize: 60, marginBottom: 10 }}>🏪</div>
              <h3>Магазин техники</h3>
              <p style={{ color: '#a1a1aa', fontSize: 16 }}>Открой свой магазин и нанимай персонал (в будущем — реальных игроков).</p>
              <button onClick={handleBuyShop} disabled={money < SHOP_PRICE} style={{ fontSize: 18, padding: 15, width: '100%', cursor: money < SHOP_PRICE ? 'not-allowed' : 'pointer', backgroundColor: money < SHOP_PRICE ? '#333' : '#8b5cf6', color: money < SHOP_PRICE ? '#888' : 'white', borderRadius: 12, fontWeight: 'bold', marginTop: 10 }}>
                {money < SHOP_PRICE ? 'Недостаточно средств' : `Открыть за 💰 ${SHOP_PRICE}`}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', alignItems: 'center' }}>
              <div style={{ ...cardStyle, width: '320px', textAlign: 'center' }}>
                <h3 style={{ marginTop: 0 }}>🏪 Магазин техники</h3>
                <p style={{ color: '#a1a1aa', fontSize: 16 }}>Накопленный доход: <b style={{ color: '#10b981' }}>{uncollectedIncome} 💰</b></p>
                <p style={{ fontSize: 14, color: '#888' }}>(Доход капает каждые 10 сек. в тестовом режиме)</p>
                
                <button onClick={handleCollectIncome} disabled={uncollectedIncome === 0} style={{ fontSize: 16, padding: 12, width: '100%', backgroundColor: uncollectedIncome > 0 ? '#10b981' : '#333', color: uncollectedIncome > 0 ? 'white' : '#888', borderRadius: 8, fontWeight: 'bold', marginBottom: 10, border: 'none' }}>
                  Собрать прибыль
                </button>
              </div>

              {!hasWorker ? (
                <button onClick={handleHireWorker} disabled={money < WORKER_SALARY} style={{ fontSize: 16, padding: 15, width: '320px', backgroundColor: money < WORKER_SALARY ? '#333' : '#3b82f6', color: money < WORKER_SALARY ? '#888' : 'white', borderRadius: 12, fontWeight: 'bold', border: 'none' }}>
                  Нанять продавца (NPC) за {WORKER_SALARY}💰
                </button>
              ) : (
                <div style={{ backgroundColor: '#1e1e24', padding: 15, borderRadius: 12, width: '320px', color: '#10b981', border: '1px solid #10b981' }}>
                  ✅ Продавец нанят. Он забирает 30% от собранной прибыли (как в жизни).
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* МАГАЗИН ПОКУПОК */}
      {activeTab === 'shop' && (
        <div>
          <h2>🏪 Магазин техники</h2>
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

      {/* ИНВЕНТАРЬ */}
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
                <button onClick={handleSellPhone} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: 8, padding: '10px 15px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Продать<br/>+{Math.floor(PHONE_PRICE * SELL_MULTIPLIER)}
                </button>
              </div>
            ) : <div style={{ color: '#52525b', padding: 40 }}>Пусто...</div>}
          </div>
        </div>
      )}

      {/* НИЖНЕЕ МЕНЮ (4 вкладки) */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: '#1e1e24', borderTop: '1px solid #333', display: 'flex', justifyContent: 'space-around', padding: '12px 0 20px 0', zIndex: 100 }}>
        <button onClick={() => setActiveTab('home')} style={{ background: 'none', border: 'none', fontSize: 12, color: activeTab === 'home' ? '#3b82f6' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>🏠</span> Главная
        </button>
        <button onClick={() => setActiveTab('business')} style={{ background: 'none', border: 'none', fontSize: 12, color: activeTab === 'business' ? '#3b82f6' : '#a1a1aa', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>🏢</span> Бизнес
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