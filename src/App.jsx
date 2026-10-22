import { useEffect, useState } from 'react';
import Participante from './pages/Participante.jsx';
import Admin from './pages/Admin.jsx';

const rota = () => (location.hash.startsWith('#/admin') ? 'admin' : 'home');

export default function App() {
  const [r, setR] = useState(rota());
  useEffect(() => {
    const f = () => setR(rota());
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r === 'admin' ? <Admin /> : <Participante />;
}
