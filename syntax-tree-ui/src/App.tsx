import { useSyntaxTreeStore } from './store';
import TopBar from './components/layout/TopBar';
import StatusBar from './components/layout/StatusBar';
import MainArea from './components/layout/MainArea';
import WelcomeScreen from './components/layout/WelcomeScreen';
import AnalysisOverlay from './components/layout/AnalysisOverlay';
import V2DevPreview from './components/architecture/v2/__dev_preview';
import ObservatoryShell from './features/observatory/ObservatoryShell';
import ObservatoryEntry from './features/observatory/ObservatoryEntry';
import SettingsPanel from './features/settings/SettingsPanel';

export default function App() {
  const analysisStatus = useSyntaxTreeStore((s) => s.analysisStatus);
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

  // Dev-only fixture preview for the v2 hierarchy view.
  if (pathname === '/__v2-preview') {
    return <V2DevPreview />;
  }

  if (pathname === '/legacy') {
    return (
      <>
        <LegacyWorkspace />
        <SettingsPanel />
      </>
    );
  }

  if (pathname.startsWith('/__observatory-preview') || pathname === '/docs' || analysisStatus === 'completed') {
    return (
      <>
        <ObservatoryShell />
        <SettingsPanel />
      </>
    );
  }

  return (
    <>
      <ObservatoryEntry />
      <SettingsPanel />
    </>
  );
}

export function LegacyWorkspace() {
  const analysisStatus = useSyntaxTreeStore((s) => s.analysisStatus);
  return (
    <>
      <TopBar />
      {analysisStatus === 'completed' ? (
        <MainArea />
      ) : (
        <WelcomeScreen />
      )}
      <StatusBar />
      {(analysisStatus === 'running' || analysisStatus === 'failed') && <AnalysisOverlay />}
    </>
  );
}
