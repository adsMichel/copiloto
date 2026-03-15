'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTrip } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartTrip(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { shareCode, token } = await createTrip({ email, name });
      if (!shareCode) {
        throw new Error('Código de viagem inválido recebido do servidor');
      }

      if (typeof token === 'string' && token.length > 0) {
        localStorage.setItem('copiloto:authToken', token);
      }

      router.push(`/trip/${shareCode}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-16 text-slate-100">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold">Compartilhe sua viagem</h1>
          <p className="text-sm text-slate-200">
            Inicie uma viagem e envie o link para alguém acompanhar sua posição em tempo real.
          </p>
        </header>

        <form className="space-y-5" onSubmit={handleStartTrip}>
          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="email">
              E-mail do piloto
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="voce@exemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-200" htmlFor="name">
              Nome (opcional)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-base text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder="Seu nome"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Criando...' : 'Iniciar viagem'}
          </button>
        </form>

        <footer className="text-center text-sm text-slate-400">
          Para acompanhar, basta abrir o link <span className="font-semibold">/trip/&lt;código&gt;</span> em outro dispositivo.
        </footer>
      </div>
    </main>
  );
}
