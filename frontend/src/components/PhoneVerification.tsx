'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface PhoneVerificationProps {
  onVerified?: () => void;
}

export function PhoneVerification({ onVerified }: PhoneVerificationProps) {
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const startCountdown = useCallback(() => {
    setCountdown(60);
    setCodeSent(true);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    setIsSending(true);
    try {
      const result = await api.sendPhoneVerification();
      if (result.success) {
        toast.success('Verification code sent to your phone');
        startCountdown();
      } else {
        toast.error(result.message || 'Failed to send verification code');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to send verification code');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      const result = await api.verifyPhone(code);
      if (result.success) {
        toast.success('Phone number verified successfully!');
        setCode('');
        setCodeSent(false);
        setCountdown(0);
        onVerified?.();
      } else {
        toast.error(result.message || 'Invalid verification code');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to verify code');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-4">
      {!codeSent ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Click below to receive a 6-digit verification code via SMS.
          </p>
        </div>
      ) : (
        <form onSubmit={handleVerify} className="space-y-3">
          <Input
            label="Verification Code"
            value={code}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(val);
            }}
            placeholder="Enter 6-digit code"
            maxLength={6}
            autoComplete="one-time-code"
            inputMode="numeric"
          />
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" isLoading={isVerifying}>
              Verify
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSendCode}
              disabled={countdown > 0}
              isLoading={isSending}
            >
              {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Code'}
            </Button>
          </div>
        </form>
      )}

      {codeSent && countdown > 0 && (
        <p className="text-xs text-gray-500">
          Code sent. Check your phone for the SMS.
        </p>
      )}

      {!codeSent && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleSendCode}
          isLoading={isSending}
        >
          Send Verification Code
        </Button>
      )}
    </div>
  );
}
