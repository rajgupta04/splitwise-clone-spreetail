import React from 'react';

export default function MoneyPipeline() {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none opacity-80">
      <svg width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
          
          <linearGradient id="edgeGradSplit" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>

          {/* Node Shadows */}
          <filter id="nodeShadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.5"/>
          </filter>
        </defs>

        {/* --- EDGES (Paths) --- */}
        {/* Source -> Central Group Node */}
        <path id="path-source" d="M150,500 C300,499 350,501 500,500" fill="none" stroke="url(#edgeGrad)" strokeWidth="4" strokeDasharray="8 8" />
        
        {/* Central Group Node -> Split Avatar 1 */}
        <path id="path-split1" d="M500,500 C650,500 700,300 850,300" fill="none" stroke="url(#edgeGradSplit)" strokeWidth="4" />
        
        {/* Central Group Node -> Split Avatar 2 */}
        <path id="path-split2" d="M500,500 C650,499 700,501 850,500" fill="none" stroke="url(#edgeGradSplit)" strokeWidth="4" />

        {/* Central Group Node -> Split Avatar 3 */}
        <path id="path-split3" d="M500,500 C650,500 700,700 850,700" fill="none" stroke="url(#edgeGradSplit)" strokeWidth="4" />

        {/* --- ANIMATED DOLLARS FLOWING --- */}
        <g filter="url(#glow)">
          <text fontSize="24" fontWeight="bold" fill="#10b981" textAnchor="middle" dominantBaseline="central">
            $
            <animateMotion dur="3s" repeatCount="indefinite" path="M150,500 C300,499 350,501 500,500" />
          </text>
        </g>

        <g filter="url(#glow)">
          <text fontSize="20" fontWeight="bold" fill="#10b981" textAnchor="middle" dominantBaseline="central">
            $
            <animateMotion dur="2.5s" begin="1.5s" repeatCount="indefinite" path="M500,500 C650,500 700,300 850,300" />
          </text>
        </g>

        <g filter="url(#glow)">
          <text fontSize="20" fontWeight="bold" fill="#10b981" textAnchor="middle" dominantBaseline="central">
            $
            <animateMotion dur="2.5s" begin="1.8s" repeatCount="indefinite" path="M500,500 C650,499 700,501 850,500" />
          </text>
        </g>

        <g filter="url(#glow)">
          <text fontSize="20" fontWeight="bold" fill="#10b981" textAnchor="middle" dominantBaseline="central">
            $
            <animateMotion dur="2.5s" begin="2.1s" repeatCount="indefinite" path="M500,500 C650,500 700,700 850,700" />
          </text>
        </g>

        {/* --- NODES --- */}
        
        {/* Source Node (Expense Payer) */}
        <g transform="translate(90, 460)" filter="url(#nodeShadow)">
          <rect width="120" height="80" rx="12" fill="#1e293b" stroke="#334155" strokeWidth="2" />
          <circle cx="60" cy="30" r="16" fill="#3b82f6" opacity="0.2" />
          <text x="60" y="34" fontSize="18" fill="#60a5fa" textAnchor="middle">👤</text>
          <text x="60" y="60" fontSize="12" fill="#94a3b8" fontWeight="bold" textAnchor="middle">Payer</text>
        </g>

        {/* Central Node (Splitwise Group) */}
        <g transform="translate(420, 440)" filter="url(#nodeShadow)">
          <rect width="160" height="120" rx="16" fill="#1e293b" stroke="#4f46e5" strokeWidth="3" />
          <circle cx="80" cy="45" r="24" fill="#4f46e5" opacity="0.2" />
          <text x="80" y="52" fontSize="26" fill="#818cf8" textAnchor="middle">👥</text>
          <text x="80" y="90" fontSize="14" fill="#f1f5f9" fontWeight="bold" textAnchor="middle">Trip Group</text>
        </g>

        {/* Target Node 1 (Split Member) */}
        <g transform="translate(850, 260)" filter="url(#nodeShadow)">
          <rect width="100" height="80" rx="12" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
          <circle cx="50" cy="30" r="14" fill="#10b981" opacity="0.2" />
          <text x="50" y="34" fontSize="16" fill="#34d399" textAnchor="middle">👤</text>
          <text x="50" y="60" fontSize="12" fill="#94a3b8" fontWeight="bold" textAnchor="middle">Split 1</text>
        </g>

        {/* Target Node 2 (Split Member) */}
        <g transform="translate(850, 460)" filter="url(#nodeShadow)">
          <rect width="100" height="80" rx="12" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
          <circle cx="50" cy="30" r="14" fill="#10b981" opacity="0.2" />
          <text x="50" y="34" fontSize="16" fill="#34d399" textAnchor="middle">👤</text>
          <text x="50" y="60" fontSize="12" fill="#94a3b8" fontWeight="bold" textAnchor="middle">Split 2</text>
        </g>

        {/* Target Node 3 (Split Member) */}
        <g transform="translate(850, 660)" filter="url(#nodeShadow)">
          <rect width="100" height="80" rx="12" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
          <circle cx="50" cy="30" r="14" fill="#10b981" opacity="0.2" />
          <text x="50" y="34" fontSize="16" fill="#34d399" textAnchor="middle">👤</text>
          <text x="50" y="60" fontSize="12" fill="#94a3b8" fontWeight="bold" textAnchor="middle">Split 3</text>
        </g>

      </svg>
    </div>
  );
}
