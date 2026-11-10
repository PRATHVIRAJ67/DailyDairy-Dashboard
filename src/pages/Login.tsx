import { useState, type FormEvent } from 'react';
import { Button, Input } from '../components/ui';
import { config } from '../config';
import { session } from '../lib/session';

export default function Login() {
  const [digits, setDigits] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phone = `+91${digits}`;

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(digits)) return setError('Enter a valid 10-digit mobile number');
    setBusy(true);
    setError(null);
    try {
      await session.sendCode(phone);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code');
    } finally {
      setBusy(false);
    }
  };
  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit code');
    setBusy(true);
    setError(null);
    try {
      await session.verify(phone, code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-forest-700 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-ivory p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="size-11" />
          <div>
            <p className="font-display text-2xl leading-none">DailyDairy</p>
            <p className="text-sm text-gray-600">Partner dashboard</p>
          </div>
        </div>
        {config.testLogin ? (
          <p className="mb-4 rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-900">Test version: no SMS is sent. Use the test code you were given.</p>
        ) : null}
        {step === 'phone' ? (
          <form onSubmit={sendCode} noValidate>
            <Input
              label="Mobile number"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              maxLength={10}
              value={digits}
              onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))}
              error={error ?? undefined}
              hint="Use the number registered as supplier or owner."
            />
            <Button type="submit" loading={busy} className="w-full">{config.testLogin ? 'Continue' : 'Send code'}</Button>
          </form>
        ) : (
          <form onSubmit={verify} noValidate>
            <p className="mb-3 text-sm text-gray-600">Signing in as <strong>{phone}</strong></p>
            <Input
              label={config.testLogin ? 'Test code' : 'Code from SMS'}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              error={error ?? undefined}
              className="tracking-[0.4em] text-lg"
            />
            <Button type="submit" loading={busy} className="w-full">Sign in</Button>
            <Button type="button" variant="ghost" className="mt-2 w-full" onClick={() => { setStep('phone'); setCode(''); setError(null); }}>Use a different number</Button>
          </form>
        )}
      </div>
    </div>
  );
}
