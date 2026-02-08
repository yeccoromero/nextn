'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Global Error:', error);
    }, [error]);

    // Check if it's a Firebase permission error
    const isPermissionError = error.name === 'FirebaseError' ||
        error.message?.includes('Missing or insufficient permissions');

    return (
        <html>
            <body>
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                    color: '#fff',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    padding: '24px',
                }}>
                    <div style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '16px',
                        padding: '48px',
                        maxWidth: '480px',
                        textAlign: 'center',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                    }}>
                        {isPermissionError ? (
                            <>
                                <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔒</div>
                                <h1 style={{
                                    fontSize: '24px',
                                    fontWeight: '600',
                                    marginBottom: '12px',
                                    color: '#f87171'
                                }}>
                                    Access Denied
                                </h1>
                                <p style={{
                                    color: '#94a3b8',
                                    fontSize: '15px',
                                    lineHeight: '1.6',
                                    marginBottom: '24px'
                                }}>
                                    You don&apos;t have permission to access this project.
                                    Please sign in with the correct account or contact the project owner.
                                </p>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</div>
                                <h1 style={{
                                    fontSize: '24px',
                                    fontWeight: '600',
                                    marginBottom: '12px',
                                    color: '#fbbf24'
                                }}>
                                    Something went wrong
                                </h1>
                                <p style={{
                                    color: '#94a3b8',
                                    fontSize: '15px',
                                    lineHeight: '1.6',
                                    marginBottom: '24px'
                                }}>
                                    An unexpected error occurred. Please try again or go back to the dashboard.
                                </p>
                            </>
                        )}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                onClick={() => reset()}
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    background: 'transparent',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                Try Again
                            </button>
                            <Link
                                href="/"
                                style={{
                                    padding: '12px 24px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                    display: 'inline-block',
                                }}
                            >
                                Go to Dashboard
                            </Link>
                        </div>
                    </div>
                </div>
            </body>
        </html>
    );
}
