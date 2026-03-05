'use client';

interface SparkPoint {
    date: string;
    price: number;
}

interface Props {
    data: SparkPoint[];
    color?: string;
    height?: number;
    width?: number;
}

export default function SparkLine({ data, color = '#2aa5ff', height = 40, width = 100 }: Props) {
    if (!data || data.length < 2) return null;

    const prices = data.map(d => d.price).filter(Boolean);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;

    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d.price - min) / range) * (height * 0.85);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const trend = prices[prices.length - 1]! > prices[0]! ? '#ef4444' : '#10b981';
    const actualColor = color === 'trend' ? trend : color;

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            className="overflow-visible"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={`spark-grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={actualColor} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={actualColor} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polyline
                fill="none"
                stroke={actualColor}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
            />
        </svg>
    );
}
