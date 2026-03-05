'use client';
import { useEffect, useRef } from 'react';

interface Props {
    publisherId: string;
    slot?: string;
    format?: 'auto' | 'rectangle' | 'leaderboard';
    className?: string;
}

declare global {
    interface Window {
        adsbygoogle?: { [key: string]: unknown }[];
    }
}

export default function AdSense({ publisherId, slot = '', format = 'auto', className = '' }: Props) {
    const ref = useRef<HTMLModElement>(null);

    useEffect(() => {
        // Only load if user consented to advertising
        const consent = JSON.parse(localStorage.getItem('cookie-consent') ?? '{}');
        if (!consent.advertising) return;
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (_) { }
    }, []);

    if (!publisherId) return null;

    return (
        <div className={`overflow-hidden ${className}`} aria-label="Publicidad">
            <ins
                ref={ref}
                className="adsbygoogle"
                style={{ display: 'block' }}
                data-ad-client={publisherId}
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive="true"
            />
        </div>
    );
}
