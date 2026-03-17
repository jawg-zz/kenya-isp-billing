'use client';

import { getPasswordStrength, PasswordStrength } from '@/lib/validation';
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password: string;
  showRequirements?: boolean;
}

function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-xs transition-colors ${met ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
      {met ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      <span>{text}</span>
    </div>
  );
}

export function PasswordStrengthMeter({ password, showRequirements = true }: PasswordStrengthMeterProps) {
  const strength: PasswordStrength = getPasswordStrength(password);

  if (!password) return null;

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
            style={{ width: `${((strength.score + 1) / 5) * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium capitalize ${
          strength.score <= 1 ? 'text-red-600 dark:text-red-400' :
          strength.score === 2 ? 'text-orange-600 dark:text-orange-400' :
          strength.score === 3 ? 'text-green-600 dark:text-green-400' :
          'text-emerald-600 dark:text-emerald-400'
        }`}>
          {strength.label}
        </span>
      </div>

      {/* Strength message */}
      {strength.message && (
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
          {strength.score <= 1 && <AlertTriangle className="h-3 w-3 text-orange-500" />}
          {strength.message}
        </p>
      )}

      {/* Requirements checklist */}
      {showRequirements && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1">
          <RequirementItem met={password.length >= 8} text="At least 8 characters" />
          <RequirementItem met={/[a-zA-Z]/.test(password)} text="Contains a letter" />
          <RequirementItem met={/[0-9]/.test(password)} text="Contains a number" />
          <RequirementItem met={/[A-Z]/.test(password)} text="Contains uppercase" />
          <RequirementItem met={/[a-z]/.test(password)} text="Contains lowercase" />
          <RequirementItem met={/[^a-zA-Z0-9]/.test(password)} text="Contains symbol" />
        </div>
      )}
    </div>
  );
}
