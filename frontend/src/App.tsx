import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { Separator } from './components/ui/separator';
import { ParkingCircle, User } from 'lucide-react';
import { useEffect } from 'react';
import useAuthBootstrap from './hooks/useAuthBootstrap';
import { useAtom, useSetAtom } from 'jotai';
import { api } from './lib/api';
import { authAtom } from './state/auth';
import { Button } from '@/components/ui/button';
import 'maplibre-gl/dist/maplibre-gl.css';
export default function App() {
  useAuthBootstrap();

  const nav = useNavigate();
  const loc = useLocation();
  const canBack = loc.pathname !== '/';

  const [user] = useAtom(authAtom);
  const setAuth = useSetAtom(authAtom);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [loc.pathname]);

  const logout = async () => {
    try { await api.post('/api/auth/logout'); }
    finally { setAuth({ id: null, email: null }); }
  };

  const myBookingBtnClick = () => {
    if (user.id !== null) {
      nav("/me/bookings")
    } else {
      nav("/login")
    }
  }

  return (
    <div className="min-h-full mx-auto max-w-md bg-white">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b">
        <div className="px-4 py-3 flex items-center gap-3">
          {canBack ? (
            <Button variant="outline" size="sm" onClick={() => nav(-1)} className="rounded-xl">Back</Button>
          ) : <div className="w-[74px]" />}

          <div className="flex items-center gap-2 mx-auto">
            <ParkingCircle className="w-5 h-5" />
            <h1 className="text-lg font-semibold">Kashiwa Parking</h1>
          </div>

          <Button variant="ghost" size="icon" onClick={myBookingBtnClick}>
            <User className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="px-4 pb-24 ">
        <Outlet />
      </main>

      <Separator />

      <footer className="fixed bottom-0 inset-x-0 bg-white/95 border-t">
        <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
          {user.id ? (
            <>
              <div className="text-xs">
                <div className="font-medium">Signed in</div>
                <div className="text-gray-500">{user.email}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => nav('/me/bookings')}>
                  My bookings
                </Button>
                <Button size="sm" className="rounded-xl" onClick={logout}>Logout</Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-xs text-gray-500">Made for mobile • Kashiwa</div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => nav('/login')} variant="outline" className="rounded-xl">Login</Button>
                <Button size="sm" onClick={() => nav('/signup')} className="rounded-xl">Sign up</Button>
              </div>
            </>
          )}
        </div>
      </footer>
    </div>
  );
}
