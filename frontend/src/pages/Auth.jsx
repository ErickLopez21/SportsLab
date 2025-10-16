import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

export default function Auth() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode'); // 'signup' o 'login'
  const [isLogin, setIsLogin] = useState(mode !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validaciones básicas
    if (!email || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      // TODO: Aquí irá la lógica de autenticación real
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simular delay
      
      // Por ahora solo simulamos éxito
      alert(isLogin ? 'Inicio de sesión exitoso' : 'Registro exitoso');
      navigate('/app');
    } catch (err) {
      setError('Ocurrió un error. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-50 to-white flex flex-col">
      {/* Header simple */}
      <header className="w-full bg-white border-b border-zinc-200 px-4 py-4">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-sm text-zinc-600 hover:text-zinc-900 font-semibold">
            ← Volver
          </Link>
          <Link to="/" className="absolute left-1/2 transform -translate-x-1/2">
            <span className="text-xl md:text-2xl font-black text-zinc-900 hover:text-sky-600 transition-colors">SportsLab</span>
          </Link>
          <div className="w-20"></div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-200 p-6 sm:p-8">
            {/* Tabs */}
            <div className="bg-zinc-100 rounded-xl p-1 grid grid-cols-2 gap-1 mb-6">
              <button
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`px-4 py-3 rounded-lg font-bold text-sm transition-all duration-200 ${
                  isLogin
                    ? 'bg-white text-sky-600 shadow-md'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Iniciar sesión
              </button>
              <button
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`px-4 py-3 rounded-lg font-bold text-sm transition-all duration-200 ${
                  !isLogin
                    ? 'bg-white text-sky-600 shadow-md'
                    : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                Registrarse
              </button>
            </div>

            {/* Título */}
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 mb-2 text-center">
              {isLogin ? 'Bienvenido de vuelta' : 'Crea tu cuenta'}
            </h1>
            <p className="text-zinc-600 text-sm text-center mb-6">
              {isLogin 
                ? 'Inicia sesión para acceder a todas las funciones' 
                : 'Únete a SportsLab y accede a análisis profesional de NFL'}
            </p>

            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                <p className="text-red-700 text-sm font-medium text-center">{error}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-zinc-900 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full bg-white border-2 border-zinc-300 rounded-xl px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-bold text-zinc-900 mb-2">
                  Contraseña
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border-2 border-zinc-300 rounded-xl px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                  required
                />
              </div>

              {!isLogin && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-bold text-zinc-900 mb-2">
                    Confirmar contraseña
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-white border-2 border-zinc-300 rounded-xl px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
              )}

              {isLogin && (
                <div className="text-right">
                  <button
                    type="button"
                    className="text-sm text-sky-600 hover:text-sky-700 font-semibold"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-4 rounded-xl bg-sky-600 text-white font-bold text-base shadow-lg hover:bg-sky-700 hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading 
                  ? 'Cargando...' 
                  : isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-zinc-500">O continúa con</span>
              </div>
            </div>

            {/* Social login */}
            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-zinc-300 bg-white text-zinc-700 font-semibold text-sm hover:bg-zinc-50 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </button>
          </div>

          {/* Terms */}
          {!isLogin && (
            <p className="mt-4 text-xs text-center text-zinc-500">
              Al registrarte, aceptas nuestros{' '}
              <a href="#terms" className="text-sky-600 hover:text-sky-700 font-semibold">
                Términos de Servicio
              </a>{' '}
              y{' '}
              <a href="#privacy" className="text-sky-600 hover:text-sky-700 font-semibold">
                Política de Privacidad
              </a>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

