import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Bot, Briefcase } from 'lucide-react';

export function Sidebar() {
    const location = useLocation();

    const navItems = [
        { path: '/', label: 'Command Center', icon: Home },
        { path: '/leads', label: 'Leads', icon: Users },
        { path: '/agents', label: 'Agents', icon: Bot },
        { path: '/projects', label: 'Projects', icon: Briefcase },
    ];

    return (
        <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col">
            <div className="p-6 border-b border-zinc-800">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    MAK OS V2
                </h1>
                <p className="text-xs text-zinc-500 mt-1">Agency Command Center</p>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                    ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100'
                                }`}
                        >
                            <Icon size={20} />
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-zinc-800">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    System Operational
                </div>
            </div>
        </aside>
    );
}
