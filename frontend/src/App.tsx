import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CommandCenter } from './pages/CommandCenter';
import { Leads } from './pages/Leads';
import { Agents } from './pages/Agents';
import { Projects } from './pages/Projects';
import { Sidebar } from './components/Sidebar';
import './index.css';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-black text-white">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<CommandCenter />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/projects" element={<Projects />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
