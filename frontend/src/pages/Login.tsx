import { useState } from 'react';
import { api } from '../lib/api';
import TopTitle from '../components/TopTitle';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { authAtom} from '../state/auth';
import { useSetAtom } from 'jotai';


export default function Login() {
    const nav = useNavigate();
    const [email, setEmail] = useState('demo@example.com');
    const [password, setPassword] = useState('password123');
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const setAuth = useSetAtom(authAtom);
    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true); setError(null);
        try {
            const res = await api.post('/api/auth/login', { email, password });
            // set immediately so footer updates without waiting a re-fetch
            setAuth({ id: res.data?.user?.id ?? null, email: res.data?.user?.email ?? null });
            nav('/');
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Login failed');
        } finally { setBusy(false); }
    };

    return (
        <>
            <TopTitle title="Welcome back" subtitle="Sign in to reserve parking" />
            <Card className="rounded-2xl">
                <CardHeader><CardTitle>Login</CardTitle></CardHeader>
                <CardContent>
                    <form className="space-y-3" onSubmit={submit}>
                        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        {error && <div className="text-red-600 text-sm">{error}</div>}
                        <Button className="w-full rounded-xl" disabled={busy}>Sign in</Button>
                    </form>
                    <p className="text-xs text-center mt-3 text-gray-500">
                        No account? <Link className="underline" to="/signup">Create one</Link>
                    </p>
                </CardContent>
            </Card>
        </>
    );
}
