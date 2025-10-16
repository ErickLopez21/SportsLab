export default function Header() {
  return (
    <header className="bg-slate-950/60 backdrop-blur border-b border-slate-800/60 sticky top-0 z-50">
      <div className="max-w-[1100px] mx-auto px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-lime-400" />
          <span className="sr-only">Logo</span>
        </div>

        <nav className="hidden md:flex items-center gap-7 text-slate-200 text-sm">
          <a href="/" className="px-4 py-2 rounded-lg bg-neutral-800 text-white font-semibold">Inicio</a>
          <a href="/explore" className="hover:text-white">Explorar (Dev)</a>
          <a href="#faq" className="hover:text-white">Preguntas Frecuentes</a>
          <a href="#about" className="hover:text-white">Sobre nosotros</a>
        </nav>

        <div className="flex items-center gap-3">
          <a href="#login" className="px-5 py-2 rounded-lg bg-lime-400 text-neutral-800 text-sm font-medium">
            Inicia Sesion
          </a>
          <a href="#signup" className="px-5 py-2 rounded-lg bg-lime-400 text-neutral-800 text-sm font-medium">
            Registrate
          </a>
        </div>
      </div>
    </header>
  );
}


