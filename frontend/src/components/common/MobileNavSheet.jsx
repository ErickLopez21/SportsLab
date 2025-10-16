import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';

function Item({ to, icon, label, onClick, active = false }) {
  return (
    <Link to={to} onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-zinc-100 ${active ? 'bg-zinc-100 text-black' : ''}`}>
      <span className="w-6 h-6" aria-hidden="true">{icon}</span>
      <span className={`text-sm font-medium ${active ? 'text-black' : 'text-zinc-800'}`}>{label}</span>
    </Link>
  );
}

export default function MobileNavSheet() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  const location = useLocation();

  const iconPath = (name) => `/icons/${name}.svg`;
  const icons = {
    home: (active) => <img src={active ? iconPath('home bold') : iconPath('home')} alt="Inicio" className="w-full h-full" />,
    users: () => <img src={iconPath('helmet')} alt="Jugadores" className="w-full h-full" />,
    profile: (active) => <img src={active ? iconPath('user bold') : iconPath('user')} alt="Perfil" className="w-full h-full" />,
    versus: (active) => <img src={active ? iconPath('sword-spade bold') : iconPath('sword-spade')} alt="Versus" className="w-full h-full" />,
    menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  };

  if (!mounted) return null;

  return (
    <>
      {createPortal(
        <div className="md:hidden fixed left-0 right-0 z-[1000] flex justify-center pointer-events-none" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 14px)' }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-full bg-white border border-zinc-200 shadow-lg text-zinc-800 pointer-events-auto"
            aria-label="Abrir navegación"
          >
            <span className="w-5 h-5">{icons.menu}</span>
            <span className="text-sm font-semibold">Menú</span>
          </button>
        </div>,
        document.body
      )}

      {open && createPortal(
        <div className="fixed inset-0 z-[1100] md:hidden" aria-modal="true" role="dialog">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl border-t border-zinc-200 shadow-2xl p-3 pt-4 translate-y-0 animate-[slideUp_200ms_ease-out]" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-zinc-300" />
            <nav className="grid grid-cols-2 gap-2">
              <Item to="/app" icon={icons.home(location.pathname === '/app' && !location.hash)} label="Inicio" active={location.pathname === '/app' && !location.hash} onClick={() => setOpen(false)} />
              <Item to="#profile" icon={icons.profile(location.hash === '#profile')} label="Perfil" active={location.hash === '#profile'} onClick={() => setOpen(false)} />
              <Item to="#players" icon={icons.users()} label="Jugadores" active={location.hash === '#players'} onClick={() => setOpen(false)} />
              <Item to="/versus" icon={icons.versus(location.pathname.startsWith('/versus'))} label="Versus" active={location.pathname.startsWith('/versus')} onClick={() => setOpen(false)} />
            </nav>
            <div className="mt-3">
              <button type="button" onClick={() => setOpen(false)} className="w-full py-2 rounded-xl bg-zinc-100 text-zinc-800 border border-zinc-200 text-sm font-medium">Cerrar</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(16px); opacity: .98 } to { transform: translateY(0); opacity: 1 } }
      `}</style>
    </>
  );
}


