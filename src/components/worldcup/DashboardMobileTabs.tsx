import { Calendar, List, LayoutGrid, Trophy, Users } from 'lucide-react';
import { WC26 } from '../../constants/design';

export type DashboardTab = 'hoy' | 'fixture' | 'grupos' | 'ranking' | 'jugadores';

const TABS: { id: DashboardTab; label: string; icon: typeof Calendar }[] = [
  { id: 'hoy', label: 'Hoy', icon: Calendar },
  { id: 'fixture', label: 'Fixture', icon: List },
  { id: 'grupos', label: 'Grupos', icon: LayoutGrid },
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  { id: 'jugadores', label: 'Jugadores', icon: Users },
];

interface DashboardMobileTabsProps {
  active: DashboardTab;
  onChange: (tab: DashboardTab) => void;
}

export function DashboardMobileTabs({ active, onChange }: DashboardMobileTabsProps) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-[20px] bg-wc26-gray100 p-1 scrollbar-none">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className="flex shrink-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-bold transition-all"
            style={{
              backgroundColor: isActive ? WC26.white : 'transparent',
              color: isActive ? WC26.blue : `${WC26.text}88`,
              boxShadow: isActive ? '0 2px 12px rgba(31,41,55,0.08)' : 'none',
            }}
          >
            <Icon className="h-4 w-4" strokeWidth={isActive ? 2.5 : 2} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
