'use client';

/**
 * AppToaster — the one react-hot-toast <Toaster> for the whole site (mounted
 * in the root layout). Every error and success message goes through
 * lib/toast.js, so they all look the same: white card, dark text, green
 * success / red error icon, top-center.
 */

import { Toaster } from 'react-hot-toast';

export default function AppToaster() {
  return (
    <Toaster
      position="top-center"
      gutter={10}
      containerStyle={{ top: 20, zIndex: 9999 }}
      toastOptions={{
        duration: 4000,
        style: {
          background: '#FFFFFF',
          color: '#1E1E1E',
          border: '1px solid #F3F3F3',
          borderRadius: '14px',
          padding: '12px 16px',
          fontSize: '14px',
          fontWeight: 500,
          maxWidth: '440px',
          boxShadow: '0 10px 30px rgba(30,30,30,0.12)',
        },
        success: { iconTheme: { primary: '#035C6C', secondary: '#FFFFFF' } },
        error: { duration: 5000, iconTheme: { primary: '#F84141', secondary: '#FFFFFF' } },
      }}
    />
  );
}
