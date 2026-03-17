'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InvoicesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/invoices/management');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
    </div>
  );
}
