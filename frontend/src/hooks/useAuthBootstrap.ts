import { useEffect } from 'react';
import { useSetAtom } from 'jotai';
import { authAtom } from '../state/auth';
import { api } from '../lib/api';

export default function useAuthBootstrap() {
  const setAuth = useSetAtom(authAtom);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get('/api/auth/me');
        if (!mounted) return;
        const user = res.data?.user ?? null;
        setAuth(user ? { id: user.id, email: user.email } : { id: null, email: null });
      } catch {
        if (!mounted) return;
        setAuth({ id: null, email: null });
      }
    })();
    return () => { mounted = false; };
  }, [setAuth]);
}
