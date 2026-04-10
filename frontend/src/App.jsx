import { useState } from 'react';
import DeckBuilderPage from './pages/DeckBuilderPage';
import LobbyPage from './pages/LobbyPage';
import BattlePage from './pages/BattlePage';

export default function App() {
  const [page, setPage] = useState('home');
  const [battleInit, setBattleInit] = useState(null);

  function startBattle(initData) {
    setBattleInit(initData);
    setPage('battle');
  }

  if (page === 'deck')   return <DeckBuilderPage onBack={() => setPage('home')} />;
  if (page === 'lobby')  return <LobbyPage onBack={() => setPage('home')} onBattleStart={startBattle} />;
  if (page === 'battle') return <BattlePage initData={battleInit} onExit={() => setPage('home')} />;

  return (
    <div className="home">
      <h1 className="home-title">⚔️ カードバトル</h1>
      <p className="home-subtitle">好きな画像でカードを作り、友人とリアルタイム対戦！</p>
      <div className="home-buttons">
        <button className="btn btn-primary btn-large" onClick={() => setPage('deck')}>
          🃏 デッキを作る
        </button>
        <button className="btn btn-success btn-large" onClick={() => setPage('lobby')}>
          🚪 対戦に参加する
        </button>
      </div>
    </div>
  );
}
