import { useCallback, useEffect, useState } from 'react';
import { Crown, Shield, Users, Swords, Trophy, RefreshCw, UserPlus, LogOut, Clock3, MapPin } from 'lucide-react';
import { Btn } from './components';

const fmt = (value: unknown) => Number(value || 0).toLocaleString('ru-RU');
const dateTime = (value?: string) => value ? new Date(value).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const resultText = (result: any) => result?.error || result?.message || (result?.success ? 'Готово' : 'Не удалось выполнить действие');

export const FamilyTab = ({ app }: { app: any }) => {
  const [state, setState] = useState<any>(null);
  const [blackMarket, setBlackMarket] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [familyTag, setFamilyTag] = useState('');
  const [inviteNickname, setInviteNickname] = useState('');
  const [depositAmount, setDepositAmount] = useState('25000');
  const [stake, setStake] = useState(100000);
  const [publicFamily, setPublicFamily] = useState<any>(null);
  const [publicLoading, setPublicLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!app.pid) return;
    setLoading(true);
    try {
      const { data, error } = await app.supabase.rpc('family_state_rpc', { p_player_id: app.pid });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setState(data);
      const { data: marketData, error: marketError } = await app.supabase.rpc('black_market_state_rpc', { p_player_id: app.pid });
      if (!marketError && !marketData?.error) setBlackMarket(marketData);
      app.setMoney?.(Number(data.money ?? app.money));
    } catch (error: any) {
      app.showMsg(error?.message || 'Не удалось загрузить семьи', true);
    } finally {
      setLoading(false);
    }
  }, [app.pid, app.supabase, app.showMsg, app.setMoney, app.money]);

  useEffect(() => {
    if (app.tab !== 'family') return;
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [app.tab, refresh]);

  const run = async (name: string, args: Record<string, unknown> = {}, successMessage?: string) => {
    if (busy) return null;
    setBusy(true);
    try {
      const { data, error } = await app.supabase.rpc(name, { p_player_id: app.pid, ...args });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.success === false) throw new Error(resultText(data));
      if (data?.money != null) app.setMoney?.(Number(data.money));
      if (data?.captured !== undefined) {
        app.showMsg(`${data.captured ? 'Территория захвачена' : 'Попытка не удалась'} · шанс ${Number(data.chance_percent).toFixed(1)}% · из семейной кассы списано ${fmt(data.stake)} ₽`);
      } else if (successMessage) app.showMsg(successMessage);
      await refresh();
      return data;
    } catch (error: any) {
      app.showMsg(error?.message || 'Не удалось выполнить действие', true);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const family = state?.family;
  const isOfficer = ['leader', 'deputy'].includes(family?.role);
  const canCreate = Number(state?.player_level || app.career?.level || 1) >= 5;
  const seasonSeconds = Number(state?.season?.seconds_left || 0);
  const depositValue = Number(depositAmount);
  const chanceFor = (territory: any) => Math.min(85, stake / (stake + Number(territory?.defense_value || territory?.base_value || 100000)) * 100);
  const openPublicFamily = async (familyId: string) => {
    setPublicLoading(true);
    try {
      const { data, error } = await app.supabase.rpc('family_public_rpc', { p_player_id: app.pid, p_family_id: familyId });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPublicFamily(data);
    } catch (error: any) {
      app.showMsg(error?.message || 'Не удалось открыть семью', true);
    } finally {
      setPublicLoading(false);
    }
  };

  return <div className="family-page">
    <div className="family-title-row">
      <div><span className="family-kicker">КОМАНДНАЯ АРКАДА</span><h2>Семья</h2></div>
      <button className="family-icon-button" onClick={() => void refresh()} disabled={loading} aria-label="Обновить"><RefreshCw size={18} className={loading ? 'family-spin' : ''} /></button>
    </div>

    <section className="family-city-hero" aria-label="Играй вместе с семьёй">
      <img src="/images/family-event.jpg" alt="Двое друзей целиком стоят на набережной на фоне вечернего города" />
      <div className="family-city-hero-copy"><span>СВОИ В ГОРОДЕ</span><b>{family?.name || 'Найди своих'}</b><small>Сезон · территории · общие события</small></div>
    </section>

    <section className="family-card family-season-card">
      <div><Trophy size={20} /><b>Сезон #{state?.season?.number ?? '—'}</b></div>
      <p>Идёт 14 дней · осталось {Math.floor(seasonSeconds / 86400)} дн. {Math.floor((seasonSeconds % 86400) / 3600)} ч.</p>
      <p>Очки дают завершённые циклы профессий: до 10 в день на игрока.</p>
      <small>Награда семьи — 1–3 место. Личная награда победившей семьи требует 20 работ за сезон.</small>
    </section>

    {family && blackMarket?.family_event && <section className="family-card">
      <h3>Семейная поставка</h3>
      <p>Сдайте вместе {blackMarket.family_event.target_units} единиц чёрному торговцу с 15:00 до 19:00 МСК. Нужны продажи минимум от {blackMarket.family_event.min_members} участников.</p>
      <div className="family-personal-score">Прогресс: <b>{blackMarket.family_event.sold_units}/{blackMarket.family_event.target_units}</b> · участников {blackMarket.family_event.member_count}/{blackMarket.family_event.min_members}</div>
      <p>{blackMarket.family_event.completed ? 'Поставка завершена — семье начислено 15 очков.' : blackMarket.family_event.joined ? 'Ты участвуешь. Твои продажи торговцу пойдут в общий зачёт.' : 'Нужно вступить до продажи товара.'}</p>
      {!blackMarket.family_event.joined && !blackMarket.family_event.completed && <Btn disabled={busy || !blackMarket.market_open || blackMarket.slot !== 2} onClick={() => void run('family_black_market_join_rpc', {}, 'Ты вступил в семейную поставку')}>Участвовать</Btn>}
    </section>}

    {publicFamily && <section className="family-card family-public-card">
      <div className="family-public-heading"><h3>[{publicFamily.tag}] {publicFamily.name}</h3><button onClick={() => setPublicFamily(null)}>Закрыть</button></div>
      <p>{publicFamily.member_count}/10 участников · {fmt(publicFamily.score)} очков</p>
      {(publicFamily.members || []).map((member: any) => <div className="family-member-row" key={member.player_id}><div><b>{member.nickname}</b><small>Ур. {member.level} · {member.profession}</small></div><span>{member.points} очков</span></div>)}
      {(publicFamily.territories || []).length > 0 && <p>Территории: {publicFamily.territories.map((territory: any) => territory.key).join(', ')}</p>}
      {publicLoading && <small>Обновляем…</small>}
    </section>}

    {family ? <>
      <section className="family-card family-identity">
        <div className="family-identity-main"><div className="family-tag">[{family.tag}]</div><div><h3>{family.name}</h3><span>{family.members?.length || 0}/10 участников · {fmt(family.score)} очков</span></div></div>
        <div className="family-luck"><span>Территории семьи</span><b>+{Number(family.luck_bonus_percent || 0).toFixed(1)} п.п. к редкому дропу</b></div>
        <div className="family-personal-score">Твои очки за сезон: <b>{family.my_points || 0}</b> · сегодня {family.today_points || 0}/10</div>
        {family.role === 'deputy' && <button className="family-action-link" disabled={busy} onClick={() => void run('family_claim_leadership_rpc', {}, 'Ты стал лидером семьи')}>Забрать лидерство, если лидер не заходил 14 дней</button>}
      </section>

      <section className="family-card family-treasury-card">
        <h3><Users size={18} /> Касса семьи</h3>
        <div className="family-treasury-balance"><span>Общий баланс</span><b>{fmt(family.cash_balance)} ₽</b></div>
        <p>Пополнять кассу могут все участники. Деньги идут на захват территорий; вывести их нельзя.</p>
        <div className="family-deposit-form">
          <label htmlFor="family-deposit-amount">Пополнение семейной кассы</label>
          <div><input id="family-deposit-amount" type="number" min="1000" step="1000" inputMode="numeric" value={depositAmount} onChange={event => setDepositAmount(event.target.value)} /><span>₽</span></div>
          <button type="button" disabled={busy || !Number.isSafeInteger(depositValue) || depositValue < 1000 || depositValue > Number(state?.money ?? app.money)} onClick={() => { if (window.confirm(`Внести ${fmt(depositValue)} ₽ в семейную кассу? Эти деньги нельзя будет вывести.`)) void run('family_cash_deposit_rpc', { p_amount: depositValue }, `В кассу семьи внесено ${fmt(depositValue)} ₽`); }}>Пополнить кассу</button>
        </div>
        <small>Твой кошелёк: {fmt(state?.money ?? app.money)} ₽ · минимум 1 000 ₽</small>
      </section>

      <section className="family-card">
        <h3><MapPin size={18} /> Территории A / B / C</h3>
        <p className="family-section-note">Попытка захвата одна на семью в день по Москве. Ставка списывается из общей кассы семьи при любом исходе.</p>
        <label className="family-stake-label">Ставка: <b>{fmt(stake)} ₽</b><input type="range" min="25000" max="500000" step="5000" value={stake} onChange={event => setStake(Number(event.target.value))} /></label>
        <div className="family-stake-presets">{[25000,100000,250000,500000].map(value => <button key={value} className={stake === value ? 'selected' : ''} onClick={() => setStake(value)}>{fmt(value)}</button>)}</div>
        <div className="family-territory-list">{(state.territories || []).map((territory: any) => {
          const owns = territory.owner_family_id === family.id;
          const attempted = Boolean(family.territory_attempted_today);
          return <article className="family-territory" key={territory.key}>
            <div className="family-territory-heading"><strong>{territory.name || `Поле ${territory.key}`}</strong><span className={territory.owner_family_id ? 'occupied' : 'free'}>{owns ? 'Ваша семья' : territory.owner_family_id ? `[${territory.owner_tag}] ${territory.owner_name}` : 'Свободна'}</span></div>
            <div className="family-territory-details">Цена базы: {fmt(territory.base_value)} ₽ · защита: {fmt(territory.defense_value)} ₽</div>
            {territory.last_attempt && <small>Последняя попытка: {territory.last_attempt.family_name} · шанс {Number(territory.last_attempt.chance_percent).toFixed(1)}% · {territory.last_attempt.succeeded ? 'успех' : 'неудача'}</small>}
            <div className="family-territory-bottom"><span>Шанс: <b>{chanceFor(territory).toFixed(1)}%</b></span><button disabled={!isOfficer || owns || attempted || busy || Number(family.cash_balance) < stake} onClick={() => void run('family_territory_attack_rpc', { p_territory_key: territory.key, p_stake: stake })}>{owns ? 'Уже ваша' : attempted ? 'Попытка сегодня использована' : Number(family.cash_balance) < stake ? 'Пополните семейную кассу' : 'Попробовать захватить'}</button></div>
          </article>;
        })}</div>
        <div className="family-territory-rules">Свободное поле защищено на 100 000 ₽: ставка 100 000 ₽ даёт 50% шанса. Захват укрепляет поле, но не выше 200 000 ₽ защиты. Каждая территория добавляет всем участникам семьи +0,5 процентного пункта к редким и эпическим находкам.</div>
        {!isOfficer && <small>Захват может начать лидер или заместитель.</small>}
      </section>

      <section className="family-card">
        <h3><Users size={18} /> Состав семьи</h3>
        {(family.members || []).map((member: any) => <div className="family-member-row" key={member.player_id}>
          <div><b>{member.role === 'leader' ? <Crown size={14} /> : member.role === 'deputy' ? <Shield size={14} /> : null}{member.nickname}</b><small>Ур. {member.level} · {member.profession} · {member.points || 0} очков · {member.has_season_reward ? 'личный порог 20 работ выполнен' : '20 работ для личного порога'}</small></div>
          <div className="family-member-actions">{family.role === 'leader' && member.role === 'member' && <button title="Назначить заместителем" disabled={busy} onClick={() => void run('family_set_deputy_rpc', { p_target_player_id: member.player_id }, 'Назначен заместитель')}><Shield size={15} /></button>}{isOfficer && member.role !== 'leader' && (family.role === 'leader' || member.role === 'member') && <button className="kick" title="Исключить из семьи" disabled={busy} onClick={() => { if (window.confirm(`Исключить ${member.nickname}? Его очки уйдут из счёта семьи.`)) void run('family_kick_rpc', { p_target_player_id: member.player_id }, 'Игрок исключён'); }}><LogOut size={15} /></button>}</div>
        </div>)}
        {family.role === 'leader' && <button className="family-action-link" disabled={busy} onClick={() => void run('family_set_deputy_rpc', { p_target_player_id: null }, 'Заместитель снят')}>Снять заместителя</button>}
        {isOfficer && <button className="family-share-invite" type="button" disabled={family.members.length >= 10} onClick={() => app.inviteFamily?.(family.id)}><UserPlus size={17} /> Отправить приглашение другу</button>}
        {isOfficer && <div className="family-inline-form"><input value={inviteNickname} onChange={event => setInviteNickname(event.target.value)} placeholder="Точный игровой ник из профиля" maxLength={32} aria-label="Точный игровой ник игрока" /><button type="button" disabled={busy || !inviteNickname.trim() || family.members.length >= 10} onClick={async () => { const done = await run('family_invite_rpc', { p_target_nickname: inviteNickname.trim().replace(/^@+/, '') }, 'Приглашение отправлено на 48 часов'); if (done) setInviteNickname(''); }}>Пригласить по нику</button></div>}
        {isOfficer && <small>Введи точный игровой ник, не Telegram username. Можно вставить ник с символом @ в начале.</small>}
        {(family.requests || []).length > 0 && <div className="family-requests"><h4>Заявки</h4>{family.requests.map((request: any) => <div className="family-member-row" key={request.id}><div><b>{request.nickname}</b><small>Уровень {request.level}</small></div><div className="family-request-actions"><button disabled={busy} onClick={() => void run('family_respond_rpc', { p_request_id: request.id, p_accept: true }, 'Игрок принят в семью')}>Принять</button><button disabled={busy} onClick={() => void run('family_respond_rpc', { p_request_id: request.id, p_accept: false }, 'Заявка отклонена')}>Отклонить</button></div></div>)}</div>}
        {(family.sent_invites || []).length > 0 && <div className="family-requests"><h4>Ожидают ответа</h4>{family.sent_invites.map((invitation: any) => <div className="family-member-row" key={invitation.id}><div><b>{invitation.nickname}</b><small>Приглашение до {dateTime(invitation.expires_at)}</small></div><span>Ожидает</span></div>)}</div>}
      </section>

      <section className="family-card family-exit-card">
        <p>Если уйдёшь или тебя исключат, твои очки снимутся с текущей семьи. Повторно вступить в другую можно через 7 дней.</p>
        <Btn variant="danger" disabled={busy} onClick={() => { if (window.confirm('Покинуть семью? Твои очки снимутся с её результата, а переход будет закрыт на 7 дней.')) void run('family_leave_rpc', {}, 'Ты покинул семью'); }}>Покинуть семью</Btn>
      </section>
    </> : <>
      {(state?.invitations || []).length > 0 && <section className="family-card"><h3>Приглашения</h3>{state.invitations.map((invitation: any) => <div className="family-invite-row" key={invitation.id}><b>[{invitation.family_tag}] {invitation.family_name}</b><div><button disabled={busy} onClick={() => void run('family_respond_rpc', { p_request_id: invitation.id, p_accept: true }, 'Ты вступил в семью')}>Вступить</button><button disabled={busy} onClick={() => void run('family_respond_rpc', { p_request_id: invitation.id, p_accept: false }, 'Приглашение отклонено')}>Отклонить</button></div></div>)}</section>}
      {(state?.applications || []).length > 0 && <section className="family-card"><h3>Мои заявки</h3>{state.applications.map((application: any) => <div className="family-member-row" key={application.id}><div><b>[{application.family_tag}] {application.family_name}</b><small>Ожидает ответа до {dateTime(application.expires_at)}</small></div><span>На рассмотрении</span></div>)}</section>}
      <section className="family-card">
        <h3><Users size={18} /> Создать семью</h3>
        <p>От 5 уровня · взнос 50 000 ₽ · максимум 10 игроков с лидером и заместителем.</p>
        {!canCreate && <small>Создание откроется на 5 уровне. Сейчас: {state?.player_level || 1}.</small>}
        {state?.switch_until && new Date(state.switch_until).getTime() > Date.now() && <small>Сменить семью можно после {dateTime(state.switch_until)}.</small>}
        <input className="family-text-input" value={familyName} onChange={event => setFamilyName(event.target.value)} placeholder="Название, 3–24 символа" maxLength={24} />
        <input className="family-text-input" value={familyTag} onChange={event => setFamilyTag(event.target.value.toUpperCase())} placeholder="Тег, 2–5 символов" maxLength={5} />
        <Btn disabled={busy || !canCreate || Number(state?.money) < 50000 || !familyName.trim() || !familyTag.trim()} onClick={async () => { const done = await run('family_create_rpc', { p_name: familyName.trim(), p_tag: familyTag.trim() }, 'Семья создана'); if (done) { setFamilyName(''); setFamilyTag(''); } }}>Создать за 50 000 ₽</Btn>
      </section>
      <section className="family-card">
        <h3><UserPlus size={18} /> Найти семью</h3>
      {(state?.families || []).map((item: any) => <div className="family-catalog-row" key={item.id}>
          <div><b>[{item.tag}] {item.name}</b><small>{item.member_count}/10 игроков · {fmt(item.score)} очков · лидер {item.leader_name || '—'}</small><button className="family-action-link" onClick={() => void openPublicFamily(item.id)}>{publicLoading ? 'Загружаем…' : 'Состав семьи'}</button></div>
          <button disabled={busy || item.member_count >= 10 || Boolean(state?.switch_until && new Date(state.switch_until).getTime() > Date.now()) || (state?.applications || []).some((application: any) => application.family_id === item.id)} onClick={() => void run('family_apply_rpc', { p_family_id: item.id }, 'Заявка отправлена на 7 дней')}>{(state?.applications || []).some((application: any) => application.family_id === item.id) ? 'Заявка отправлена' : 'Подать заявку'}</button>
        </div>)}
        {!(state?.families || []).length && <p>Пока нет семей. Создай первую и позови друзей.</p>}
      </section>
    </>}

    <section className="family-card">
      <h3><Trophy size={18} /> Рейтинг сезона</h3>
      {(state?.leaderboard || []).slice(0, 10).map((item: any) => <div className="family-rank-row" key={item.id}><button onClick={() => void openPublicFamily(item.id)}>#{item.place} [{item.tag}] {item.name}</button><span>{fmt(item.score)} очков · {item.member_count}/10</span></div>)}
      {!(state?.leaderboard || []).length && <p>Очков пока нет. Начисляются за завершённые циклы профессий.</p>}
    </section>

    {(state?.history || []).length > 0 && <section className="family-card">
      <h3><Clock3 size={18} /> Победители прошлых сезонов</h3>
      {state.history.map((row: any, index: number) => <div className="family-history-row" key={`${row.season_no}-${row.family_tag}-${index}`}><b>Сезон #{row.season_no} · {row.place === 1 ? '🥇' : row.place === 2 ? '🥈' : '🥉'} [{row.family_tag}] {row.family_name}</b><span>{fmt(row.score)} очков</span></div>)}
    </section>}

    {(state?.awards || []).length > 0 && <section className="family-card"><h3>Твои постоянные значки</h3>{state.awards.map((award: any) => <div className="family-history-row" key={`${award.season_no}-${award.place}`}>🏆 Сезон #{award.season_no} · место семьи {award.place} · твой вклад {award.contribution} работ</div>)}</section>}
    <div className="family-footer"><Swords size={15} /> Семейные очки не дают деньги: сезонное соревнование отдельно от экономики. Территории дают только небольшой шанс на редкую находку.</div>
    {busy && <div className="family-busy">Выполняем действие…</div>}
  </div>;
};
