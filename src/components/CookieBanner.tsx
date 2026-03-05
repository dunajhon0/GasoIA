'use client';
import { useState, useEffect } from 'react';

interface ConsentState {
    analytics: boolean;
    advertising: boolean;
}

export default function CookieBanner() {
    const [visible, setVisible] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [consent, setConsent] = useState<ConsentState>({ analytics: false, advertising: false });

    useEffect(() => {
        const stored = localStorage.getItem('cookie-consent');
        if (!stored) setVisible(true);
    }, []);

    const save = (full: boolean) => {
        const state: ConsentState = full
            ? { analytics: true, advertising: true }
            : consent;
        localStorage.setItem('cookie-consent', JSON.stringify({ ...state, ts: Date.now() }));
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label="Aviso de cookies"
            className="fixed bottom-0 inset-x-0 z-50 p-4 md:p-6 animate-slide-up"
        >
            <div className="max-w-4xl mx-auto card p-5 md:p-6 shadow-2xl">
                <div className="flex items-start gap-4">
                    <span className="text-3xl shrink-0" aria-hidden="true">🍪</span>
                    <div className="flex-1 min-w-0">
                        <h2 className="font-bold text-base mb-1">Usamos cookies</h2>
                        <p className="text-sm text-muted mb-4 leading-relaxed">
                            Utilizamos cookies propias y de terceros para mejorar tu experiencia, mostrar anuncios personalizados y analizar el tráfico.
                            Puedes aceptarlas todas, rechazarlas o personalizar tu elección.{' '}
                            <a href="/legal/cookies" className="text-brand-500 underline hover:no-underline">
                                Más información
                            </a>.
                        </p>

                        {expanded && (
                            <div className="card-flat p-4 mb-4 space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" checked disabled className="w-4 h-4 accent-brand-500" />
                                    <span className="text-sm">
                                        <strong>Necesarias</strong> — siempre activas, esenciales para el funcionamiento.
                                    </span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={consent.analytics}
                                        onChange={e => setConsent(c => ({ ...c, analytics: e.target.checked }))}
                                        className="w-4 h-4 accent-brand-500"
                                    />
                                    <span className="text-sm">
                                        <strong>Analíticas</strong> — nos ayudan a entender cómo usas el sitio.
                                    </span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={consent.advertising}
                                        onChange={e => setConsent(c => ({ ...c, advertising: e.target.checked }))}
                                        className="w-4 h-4 accent-brand-500"
                                    />
                                    <span className="text-sm">
                                        <strong>Publicidad</strong> — para anuncios relevantes (Google AdSense).
                                    </span>
                                </label>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => save(true)} className="btn-primary text-sm">Aceptar todo</button>
                            <button onClick={() => save(false)} className="btn-secondary text-sm">Rechazar</button>
                            {!expanded
                                ? <button onClick={() => setExpanded(true)} className="btn-ghost text-sm">Personalizar</button>
                                : <button onClick={() => save(false)} className="btn-secondary text-sm">Guardar ajustes</button>
                            }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
