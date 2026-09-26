import { GameScreen } from './ui/game/GameScreen';
import { Lobby } from './ui/screens/Lobby';
import { MainMenu } from './ui/screens/MainMenu';
import { Multiplayer } from './ui/screens/Multiplayer';
import { RulesScreen } from './ui/screens/RulesScreen';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { SoloSetup } from './ui/screens/SoloSetup';
import { useStore } from './ui/store';

function ErrorToast() {
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);
  if (!error) return null;
  return (
    <div className="toast">
      <div className="error-banner" role="alert">
        <span>{error}</span>
        <button className="btn btn-small" onClick={() => setError(null)} aria-label="Fermer">✕</button>
      </div>
    </div>
  );
}

export default function App() {
  const screen = useStore((s) => s.screen);
  return (
    <>
      {screen === 'menu' && <MainMenu />}
      {screen === 'solo' && <SoloSetup />}
      {screen === 'multi' && <Multiplayer />}
      {screen === 'lobby' && <Lobby />}
      {screen === 'game' && <GameScreen />}
      {screen === 'rules' && <RulesScreen />}
      {screen === 'settings' && <SettingsScreen />}
      <ErrorToast />
    </>
  );
}
