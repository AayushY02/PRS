import { useState } from 'react';

import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import TopTitle from '../components/TopTitle';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { authAtom } from '../state/auth';
import {  useSetAtom } from 'jotai';


export default function Signup() {
    const nav = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('password123');
    const [error, setError] = useState<string | null>(null);

    const setAuth = useSetAtom(authAtom);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            const res = await api.post('/api/auth/signup', { email, password });
            setAuth({ id: res.data?.user?.id ?? null, email: res.data?.user?.email ?? null });
            nav('/');
        } catch (e: any) {
            setError(e?.response?.data?.error || 'Signup failed');
        }
    };
    return (
        <>
            <TopTitle title="Create account" subtitle="Reserve your first spot in seconds" />
            <Card className="rounded-2xl">
                <CardHeader><CardTitle>Sign up</CardTitle></CardHeader>
                <CardContent>
                    <form className="space-y-3" onSubmit={submit}>
                        <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        {error && <div className="text-red-600 text-sm">{error}</div>}
                        <Button className="w-full rounded-xl">Create account</Button>
                    </form>
                    <p className="text-xs text-center mt-3 text-gray-500">
                        Have an account? <Link className="underline" to="/login">Log in</Link>
                    </p>
                </CardContent>
            </Card>
        </>
    );
}
