'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ProjectError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Project Error:', error);
    }, [error]);

    // Check if it's a Firebase permission error
    const isPermissionError = error.name === 'FirebaseError' ||
        error.message?.includes('Missing or insufficient permissions');

    const isNotFound = error.message?.includes('not found') ||
        error.message?.includes('does not exist');

    return (
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
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
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
                ) : isNotFound ? (
                    <>
                        <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔍</div>
                        <h1 style={{
                            fontSize: '24px',
                            fontWeight: '600',
                            marginBottom: '12px',
                            color: '#fbbf24'
                        }}>
                            Project Not Found
                        </h1>
                        <p style={{
                            color: '#94a3b8',
                            fontSize: '15px',
                            lineHeight: '1.6',
                            marginBottom: '24px'
                        }}>
                            The project you&apos;re looking for doesn&apos;t exist or has been deleted.
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
                            We couldn&apos;t load this project. Please try again.
                        </p>
                    </>
                )}

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
                        }}
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
                        }}
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
