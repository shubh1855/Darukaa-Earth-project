import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';

function App() {
  return (
    <main className="app">
      <h1>Darukaa.Earth</h1>
      <p>Phase 0 complete. Next step: authentication and project dashboard implementation.</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
