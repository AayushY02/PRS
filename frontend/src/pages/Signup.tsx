// import { useState } from 'react';

// import { useNavigate, Link } from 'react-router-dom';
// import { api } from '../lib/api';
// import TopTitle from '../components/TopTitle';
// import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
// import { Input } from '../components/ui/input';
// import { Button } from '../components/ui/button';
// import { authAtom } from '../state/auth';
// import {  useSetAtom } from 'jotai';


// export default function Signup() {
//     const nav = useNavigate();
//     const [email, setEmail] = useState('');
//     const [password, setPassword] = useState('password123');
//     const [error, setError] = useState<string | null>(null);

//     const setAuth = useSetAtom(authAtom);

//     const submit = async (e: React.FormEvent) => {
//         e.preventDefault();
//         setError(null);
//         try {
//             const res = await api.post('/api/auth/signup', { email, password });
//             setAuth({ id: res.data?.user?.id ?? null, email: res.data?.user?.email ?? null });
//             nav('/');
//         } catch (e: any) {
//             setError(e?.response?.data?.error || 'Signup failed');
//         }
//     };
//     return (
//         <>
//             <TopTitle title="Create account" subtitle="Reserve your first spot in seconds" />
//             <Card className="rounded-2xl">
//                 <CardHeader><CardTitle>Sign up</CardTitle></CardHeader>
//                 <CardContent>
//                     <form className="space-y-3" onSubmit={submit}>
//                         <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
//                         <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
//                         {error && <div className="text-red-600 text-sm">{error}</div>}
//                         <Button className="w-full rounded-xl">Create account</Button>
//                     </form>
//                     <p className="text-xs text-center mt-3 text-gray-500">
//                         Have an account? <Link className="underline" to="/login">Log in</Link>
//                     </p>
//                 </CardContent>
//             </Card>
//         </>
//     );
// }


import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import TopTitle from '../components/TopTitle';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { authAtom } from '../state/auth';
import { useSetAtom } from 'jotai';
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react';

export default function Signup() {
  const nav = useNavigate();
  const setAuth = useSetAtom(authAtom);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [showPwd, setShowPwd] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const emailValid = useMemo(() => {
    // Simple but solid RFC-ish email check
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  const { score, label, percent, barClass } = useMemo(() => {
    const v = password ?? '';
    let s = 0;
    if (v.length >= 8) s++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++;
    if (/\d/.test(v)) s++;
    if (/[^A-Za-z0-9]/.test(v)) s++;
    const labels = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'];
    const clz = [
      'bg-red-500',
      'bg-orange-500',
      'bg-yellow-500',
      'bg-emerald-500',
      'bg-emerald-600',
    ][s];
    const pct = (s / 4) * 100;
    return {
      score: s,
      label: labels[s],
      percent: pct,
      barClass: clz,
    };
  }, [password]);

  const canSubmit = emailValid && score >= 2 && !submitting;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post('/api/auth/signup', {
        email: email.trim().toLowerCase(),
        password,
      });
      setAuth({
        id: res.data?.user?.id ?? null,
        email: res.data?.user?.email ?? null,
      });
      nav('/');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  };

  // caps lock detection on password field
  const onKeyPressCheckCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Some browsers expose getModifierState
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const caps = (e as any).getModifierState?.('CapsLock');
    if (typeof caps === 'boolean') setCapsOn(caps);
  };

  // Trim + lowercase email on blur
  useEffect(() => {
    setEmail((prev) => prev.trim());
  }, []);

  return (
    <>
      <TopTitle
        title="Create account"
        subtitle="Reserve your first spot in seconds"
      />

      <Card className="rounded-2xl max-w-md w-full mx-auto shadow-sm border">
        <CardHeader>
          <CardTitle className="text-lg">Sign up</CardTitle>
        </CardHeader>

        <CardContent>
          <form className="space-y-4" onSubmit={submit} noValidate>
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 rounded-xl"
                  aria-invalid={!emailValid && email.length > 0}
                  onBlur={() => setEmail((v) => v.trim().toLowerCase())}
                />
              </div>
              {!emailValid && email.length > 0 && (
                <p className="text-xs text-red-600">Please enter a valid email.</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={onKeyPressCheckCaps}
                  onKeyDown={onKeyPressCheckCaps}
                  className="pl-9 pr-10 rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Caps lock hint */}
              {capsOn && (
                <p className="text-xs text-amber-600">Caps Lock is on.</p>
              )}

              {/* Strength meter */}
              <div className="space-y-1">
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${barClass} transition-all`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Password strength: <span className="font-medium">{label}</span></span>
                  <span className="tabular-nums">
                    {password.length}/8+
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Use a mix of upper/lowercase, numbers, and symbols.
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" aria-live="polite">
                {error}
              </div>
            )}

            {/* Submit */}
            <Button
              className="w-full rounded-xl"
              disabled={!canSubmit}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create account
            </Button>
          </form>

          <p className="text-xs text-center mt-4 text-muted-foreground">
            Have an account?{' '}
            <Link className="underline underline-offset-2 hover:text-foreground" to="/login">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
