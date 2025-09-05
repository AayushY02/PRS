import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import TopTitle from '../components/TopTitle';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Link, useNavigate } from 'react-router-dom';
import { authAtom } from '../state/auth';
import { useSetAtom } from 'jotai';
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react';

export default function Login() {
  const nav = useNavigate();
  const setAuth = useSetAtom(authAtom);

  const [email, setEmail] = useState('demo@example.com');
  const [password, setPassword] = useState('password123');
  const [showPwd, setShowPwd] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailValid = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()), [email]);
  const canSubmit = emailValid && password.length >= 1 && !busy;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post('/api/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      setAuth({
        id: res.data?.user?.id ?? null,
        email: res.data?.user?.email ?? null,
      });
      nav('/');
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  const onKeyPressCheckCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Some browsers support this; safe to ignore if absent
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const caps = (e as any).getModifierState?.('CapsLock');
    if (typeof caps === 'boolean') setCapsOn(caps);
  };

  // normalize email on first mount
  useEffect(() => setEmail((v) => v.trim()), []);

  return (
    <>
      <TopTitle title="Welcome back" subtitle="Sign in to reserve parking" />

      <Card className="rounded-2xl max-w-md w-full mx-auto shadow-sm border">
        <CardHeader>
          <CardTitle className="text-lg">Login</CardTitle>
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
                  autoComplete="username"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmail((v) => v.trim().toLowerCase())}
                  aria-invalid={!emailValid && email.length > 0}
                  className="pl-9 rounded-xl"
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
                  autoComplete="current-password"
                  placeholder="Your password"
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
              {capsOn && <p className="text-xs text-amber-600">Caps Lock is on.</p>}
            </div>

            {/* Error */}
            {error && (
              <div
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                aria-live="polite"
              >
                {error}
              </div>
            )}

            {/* Submit */}
            <Button className="w-full rounded-xl" disabled={!canSubmit}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <p className="text-xs text-center mt-4 text-muted-foreground">
            No account?{' '}
            <Link className="underline underline-offset-2 hover:text-foreground" to="/signup">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </>
  );
}
