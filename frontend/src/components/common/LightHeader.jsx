import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function LightHeader({ league = 'NFL', onLeagueChange, hideLeagueSelector = false, leftLogoSrc, hideMenuButton = false, leftLogoClassName, showAuthButtons = false }) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
    } else {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, [menuOpen]);
  
  return (
    <>
    <header className="w-full bg-white border-b-2 border-zinc-200/80 sticky top-0 z-50 backdrop-blur-sm bg-white/95 shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-3 md:px-6 lg:px-8 py-3 md:py-4 flex items-center justify-between gap-3">
        {/* Left - Title */}
        <div className="flex items-center gap-3">
          {!hideMenuButton && (
            <button 
              type="button" 
              onClick={() => setMenuOpen(true)} 
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-zinc-200 bg-white text-zinc-800 md:hidden" 
              aria-label="Abrir menú"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
          )}
          <Link to="/" className="text-xl md:text-2xl lg:text-3xl font-black tracking-tight text-zinc-900 hover:text-sky-600 transition-colors">
            SportsLab
          </Link>
        </div>

        {/* Right - Auth Buttons (Landing) */}
        {showAuthButtons && (
          <div className="flex items-center justify-end gap-2 md:gap-3">
            <Link
              to="/auth?mode=login"
              className="inline-flex items-center px-3 py-2 md:px-4 md:py-2.5 rounded-lg border border-zinc-300 text-zinc-700 font-semibold text-xs md:text-sm hover:bg-zinc-50 hover:border-zinc-400 transition-all"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/auth?mode=signup"
              className="inline-flex px-4 py-2 md:px-6 md:py-3 rounded-xl bg-sky-600 text-white font-bold text-xs md:text-sm shadow-md hover:bg-sky-700 hover:shadow-lg transition-all duration-200"
            >
              Suscribirse
            </Link>
          </div>
        )}

        {/* Right - League selector (desktop) */}
        {!hideLeagueSelector && !showAuthButtons && (
          <div className="hidden md:flex items-center justify-end">
            <div className="flex items-center gap-2 bg-zinc-100 rounded-full border border-zinc-200 px-4 py-2">
              <img src="/logos/leagues/nfl.svg" alt="NFL" className="w-5 h-5" />
              <span className="text-sm font-semibold text-zinc-900">NFL</span>
            </div>
          </div>
        )}

        {/* Mobile league selector button (right aligned small) */}
        {!hideLeagueSelector && !showAuthButtons && (
          <div className="flex items-center justify-end md:hidden">
            <div className="inline-flex items-center gap-2 px-3 h-9 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-800 text-sm">
              <img src="/logos/leagues/nfl.svg" alt="liga" className="w-5 h-5" />
              <span className="font-semibold">NFL</span>
            </div>
          </div>
        )}
      </div>
    </header>

      {/* Side menu sheet - Portal outside header */}
      {!hideMenuButton && menuOpen && (
        <div className="fixed inset-0 h-screen w-screen" style={{ zIndex: 9999 }}>
          <div className="fixed inset-0 h-screen w-screen bg-black/30" onClick={() => setMenuOpen(false)} />
          <aside className="fixed left-0 top-0 h-screen w-64 max-w-[80%] bg-white border-r border-zinc-200 shadow-xl p-3 flex flex-col overflow-y-auto overscroll-contain" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)', paddingLeft: 'env(safe-area-inset-left)' }}>
            <div className="text-zinc-900 text-base font-extrabold mb-2 px-2">Menú</div>
            <nav className="flex-1 flex flex-col gap-1">
                  <Link to="/app" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-50 text-zinc-800 font-medium">
                    <img src="/icons/home bold.svg" alt="Inicio" className="w-5 h-5" />
                    Inicio
                  </Link>
                  <Link to="/players" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-50 text-zinc-800 font-medium">
                    <img src="/icons/user bold.svg" alt="Jugadores" className="w-5 h-5" />
                    Jugadores
                  </Link>
                  <Link to="/versus" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-50 text-zinc-800 font-medium">
                    <img src="/icons/sword-spade bold.svg" alt="Versus" className="w-5 h-5" />
                    Versus
                  </Link>
            </nav>
            <div className="border-t border-zinc-200 pt-2 mt-2 bg-white" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}>
              <a href="#profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-50 text-zinc-800 font-medium">
                <img src="/icons/user bold.svg" alt="Perfil" className="w-5 h-5" />
                Perfil
              </a>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}


