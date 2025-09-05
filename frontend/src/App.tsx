// // import { Outlet, useLocation, useNavigate } from 'react-router-dom';

// // import { Separator } from './components/ui/separator';
// // import { ParkingCircle, User } from 'lucide-react';
// // import { useEffect } from 'react';
// // import useAuthBootstrap from './hooks/useAuthBootstrap';
// // import { useAtom, useSetAtom } from 'jotai';
// // import { api } from './lib/api';
// // import { authAtom } from './state/auth';
// // import { Button } from '@/components/ui/button';
// // import 'maplibre-gl/dist/maplibre-gl.css';
// // export default function App() {
// //   useAuthBootstrap();

// //   const nav = useNavigate();
// //   const loc = useLocation();
// //   const canBack = loc.pathname !== '/';

// //   const [user] = useAtom(authAtom);
// //   const setAuth = useSetAtom(authAtom);

// //   useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [loc.pathname]);

// //   const logout = async () => {
// //     try { await api.post('/api/auth/logout'); }
// //     finally { setAuth({ id: null, email: null }); }
// //   };

// //   const myBookingBtnClick = () => {
// //     if (user.id !== null) {
// //       nav("/me/bookings")
// //     } else {
// //       nav("/login")
// //     }
// //   }

// //   return (
// //     <div className="min-h-full mx-auto max-w-md bg-white">
// //       <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b">
// //         <div className="px-4 py-3 flex items-center gap-3">
// //           {canBack ? (
// //             <Button variant="outline" size="sm" onClick={() => nav(-1)} className="rounded-xl">Back</Button>
// //           ) : <div className="w-[74px]" />}

// //           <div className="flex items-center gap-2 mx-auto">
// //             <ParkingCircle className="w-5 h-5" />
// //             <h1 className="text-lg font-semibold">Kashiwa Parking</h1>
// //           </div>

// //           <Button variant="ghost" size="icon" onClick={myBookingBtnClick}>
// //             <User className="w-5 h-5" />
// //           </Button>
// //         </div>
// //       </header>

// //       <main className="px-4 pb-24 ">
// //         <Outlet />
// //       </main>

// //       <Separator />

// //       <footer className="fixed bottom-0 inset-x-0 bg-white/95 border-t">
// //         <div className="mx-auto max-w-md px-4 py-3 flex items-center justify-between">
// //           {user.id ? (
// //             <>
// //               <div className="text-xs">
// //                 <div className="font-medium">Signed in</div>
// //                 <div className="text-gray-500">{user.email}</div>
// //               </div>
// //               <div className="flex gap-2">
// //                 <Button size="sm" variant="outline" className="rounded-xl" onClick={() => nav('/me/bookings')}>
// //                   My bookings
// //                 </Button>
// //                 <Button size="sm" className="rounded-xl" onClick={logout}>Logout</Button>
// //               </div>
// //             </>
// //           ) : (
// //             <>
// //               <div className="text-xs text-gray-500">Made for mobile • Kashiwa</div>
// //               <div className="flex gap-2">
// //                 <Button size="sm" onClick={() => nav('/login')} variant="outline" className="rounded-xl">Login</Button>
// //                 <Button size="sm" onClick={() => nav('/signup')} className="rounded-xl">Sign up</Button>
// //               </div>
// //             </>
// //           )}
// //         </div>
// //       </footer>
// //     </div>
// //   );
// // }


// import { Outlet, useLocation, useNavigate } from 'react-router-dom';
// import { useEffect, useMemo } from 'react';
// import { useAtom, useSetAtom } from 'jotai';
// import { ParkingCircle, User, ArrowLeft } from 'lucide-react';

// import useAuthBootstrap from './hooks/useAuthBootstrap';
// import { api } from './lib/api';
// import { authAtom } from './state/auth';

// import { Button } from '@/components/ui/button';
// import 'maplibre-gl/dist/maplibre-gl.css';

// export default function App() {
//   useAuthBootstrap();

//   const nav = useNavigate();
//   const loc = useLocation();
//   const canBack = loc.pathname !== '/';

//   const [user] = useAtom(authAtom);
//   const setAuth = useSetAtom(authAtom);

//   useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [loc.pathname]);

//   const logout = async () => {
//     try { await api.post('/api/auth/logout'); }
//     finally { setAuth({ id: null, email: null }); }
//   };

//   const myBookingBtnClick = () => {
//     if (user.id !== null) nav('/me/bookings');
//     else nav('/login');
//   };

//   const userInitial = useMemo(
//     () => (user.email ? user.email.charAt(0).toUpperCase() : 'U'),
//     [user.email]
//   );

//   return (
//     <div className="min-h-screen w-full bg-white">
//       <div className="mx-auto max-w-md min-h-screen">

//         {/* Solid, centered, modern header */}
//         <header
//           className="sticky top-0 z-50 bg-white border-b shadow-sm"
//           style={{ paddingTop: 'env(safe-area-inset-top)' }}
//         >
//           <div className="relative mx-auto max-w-md px-3">
//             {/* Row: left/right controls; title is absolutely centered */}
//             <div className="h-14 flex items-center justify-between">
//               {/* Left: Back (keeps fixed width so center never shifts) */}
//               <div className="w-10">
//                 {canBack ? (
//                   <Button
//                     variant="outline"
//                     size="icon"
//                     onClick={() => nav(-1)}
//                     className="h-10 w-10 rounded-xl"
//                     aria-label="Back"
//                   >
//                     <ArrowLeft className="h-5 w-5" />
//                   </Button>
//                 ) : (
//                   <div className="h-10 w-10" />
//                 )}
//               </div>

//               {/* Right: Profile/Login (same fixed width for symmetry) */}
//               <div className="w-10 flex justify-end">
//                 <Button
//                   variant="ghost"
//                   size="icon"
//                   onClick={myBookingBtnClick}
//                   className="h-10 w-10 rounded-xl border hover:bg-accent"
//                   aria-label={user.id ? 'My bookings' : 'Login'}
//                   title={user.id ? 'My bookings' : 'Login'}
//                 >
//                   {user.id ? (
//                     <span className="inline-grid place-items-center rounded-full h-5 w-5 text-xs font-bold">
//                       {userInitial}
//                     </span>
//                   ) : (
//                     <User className="w-5 h-5" />
//                   )}
//                 </Button>
//               </div>

//               {/* Center: Brand (absolutely centered; never shifts) */}
//               <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
//                 <div className="flex items-center gap-2">
//                   <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl border bg-white">
//                     <ParkingCircle className="w-5 h-5" />
//                   </div>
//                   <h1 className="text-lg font-semibold text-slate-900">
//                     Kashiwa Parking
//                   </h1>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </header>

//         {/* Main content — leave room for the fixed footer */}
//         <main
//           className="px-4 pt-3"
//           style={{ paddingBottom: 'calc(8rem + env(safe-area-inset-bottom))' }} // reserve space for footer
//         >
//           <Outlet />
//         </main>

//         {/* Solid, always-visible fixed footer */}
//         <footer
//           className="fixed bottom-0 inset-x-0 z-50 bg-white border-t shadow-md"
//           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
//         >
//           <div className="mx-auto max-w-md px-4 py-3">
//             {user.id ? (
//               <div className="flex items-center justify-between gap-3">
//                 <div className="min-w-0">
//                   <div className="text-xs text-muted-foreground">Signed in</div>
//                   <div className="text-sm font-medium truncate">{user.email}</div>
//                 </div>
//                 <div className="flex gap-2">
//                   <Button
//                     size="sm"
//                     variant="outline"
//                     className="rounded-xl"
//                     onClick={() => nav('/me/bookings')}
//                   >
//                     My bookings
//                   </Button>
//                   <Button size="sm" className="rounded-xl" onClick={logout}>
//                     Logout
//                   </Button>
//                 </div>
//               </div>
//             ) : (
//               <div className="flex items-center justify-between gap-3">
//                 <div className="text-xs text-muted-foreground">
//                   Made for mobile • Kashiwa
//                 </div>
//                 <div className="flex gap-2">
//                   <Button size="sm" onClick={() => nav('/login')} variant="outline" className="rounded-xl">
//                     Login
//                   </Button>
//                   <Button size="sm" onClick={() => nav('/signup')} className="rounded-xl">
//                     Sign up
//                   </Button>
//                 </div>
//               </div>
//             )}
//           </div>
//         </footer>

//       </div>
//     </div>
//   );
// }


import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import React, { useEffect, useMemo } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { ParkingCircle, User, ArrowLeft, Smartphone } from 'lucide-react';

import useAuthBootstrap from './hooks/useAuthBootstrap';
import { api } from './lib/api';
import { authAtom } from './state/auth';
import { Button } from '@/components/ui/button';

import 'maplibre-gl/dist/maplibre-gl.css';

// ---- Mobile-only gate (≤520px) ---------------------------------------------
function useIsMobile(maxWidth = 520) {
  const mq = `(max-width: ${maxWidth}px)`;
  const isServer = typeof window === 'undefined';
  const initial = isServer ? true : window.matchMedia(mq).matches;

  const [isMobile, setIsMobile] = React.useState(initial);

  useEffect(() => {
    if (isServer) return;
    const mql = window.matchMedia(mq);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [mq, isServer]);

  return isMobile;
}

// Fix 100vh on mobile (accounts for browser chrome)
function useMobileVhVar() {
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVh();
    window.addEventListener('resize', setVh);
    window.addEventListener('orientationchange', setVh);
    return () => {
      window.removeEventListener('resize', setVh);
      window.removeEventListener('orientationchange', setVh);
    };
  }, []);
}

export default function App() {
  useAuthBootstrap();
  useMobileVhVar();

  const isMobile = useIsMobile(520);

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
    if (user.id !== null) nav('/me/bookings');
    else nav('/login');
  };

  const userInitial = useMemo(
    () => (user.email ? user.email.charAt(0).toUpperCase() : 'U'),
    [user.email]
  );

  // ---- Desktop / large-screen blocker --------------------------------------
  if (!isMobile) {
    return (
      <div
        className="min-h-screen grid place-items-center bg-slate-50 text-slate-800"
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-md w-full px-6 py-10 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border bg-white shadow-sm">
            <Smartphone className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">Mobile device required</h1>
          <p className="mt-2 text-sm text-slate-600">
            This app is optimized for small screens. Please open it on a phone (≤520px width).
          </p>
          <div className="mt-6 text-xs text-slate-500">
            Tip: Resize your browser to test, or use device emulation in DevTools.
          </div>
        </div>
      </div>
    );
  }

  // ---- Mobile experience ----------------------------------------------------
  return (
    <div
      className="min-h-[calc(var(--vh,1vh)*100)] w-full bg-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto max-w-[420px] min-h-[calc(var(--vh,1vh)*100)]">

        {/* Header */}
        <header
          className="sticky top-0 z-50 bg-white border-b shadow-sm"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="relative mx-auto max-w-[420px] px-3">
            <div className="h-14 flex items-center justify-between">
              {/* Left: Back */}
              <div className="w-10">
                {canBack ? (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => nav(-1)}
                    className="h-10 w-10 rounded-xl"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                ) : (
                  <div className="h-10 w-10" />
                )}
              </div>

              {/* Right: Profile/Login */}
              <div className="w-10 flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={myBookingBtnClick}
                  className="h-10 w-10 rounded-xl border hover:bg-accent"
                  aria-label={user.id ? 'My bookings' : 'Login'}
                  title={user.id ? 'My bookings' : 'Login'}
                >
                  {user.id ? (
                    <span className="inline-grid place-items-center rounded-full h-5 w-5 text-xs font-bold">
                      {userInitial}
                    </span>
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </Button>
              </div>

              {/* Center: Brand */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
                <div className="flex items-center gap-2">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-xl border bg-white">
                    <ParkingCircle className="w-5 h-5" />
                  </div>
                  <h1 className="text-lg font-semibold text-slate-900">
                    Kashiwa Parking
                  </h1>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main */}
        <main
          className="px-4 pt-3"
          style={{ paddingBottom: 'calc(7.5rem + env(safe-area-inset-bottom))' }}
        >
          <Outlet />
        </main>

        {/* Footer */}
        <footer
          className="fixed bottom-0 inset-x-0 z-50 bg-white border-t shadow-md"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="mx-auto max-w-[420px] px-4 py-3">
            {user.id ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Signed in</div>
                  <div className="text-sm font-medium truncate">{user.email}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => nav('/me/bookings')}
                  >
                    My bookings
                  </Button>
                  <Button size="sm" className="rounded-xl" onClick={logout}>
                    Logout
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Made for mobile • Kashiwa
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => nav('/login')} variant="outline" className="rounded-xl">
                    Login
                  </Button>
                  <Button size="sm" onClick={() => nav('/signup')} className="rounded-xl">
                    Sign up
                  </Button>
                </div>
              </div>
            )}
          </div>
        </footer>

      </div>
    </div>
  );
}
