/** Chocolate derretido com fitas rosa e douradas (SVG, nítido em qualquer tela). */
export function ChocolateWave({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 110" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="wave-choco" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a110b" />
          <stop offset="0.65" stopColor="#6b321c" />
          <stop offset="1" stopColor="#3c1a0f" />
        </linearGradient>
        <linearGradient id="wave-pink" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#c20d62" />
          <stop offset="0.35" stopColor="#ff4b9f" />
          <stop offset="0.7" stopColor="#f52b87" />
          <stop offset="1" stopColor="#a90a55" />
        </linearGradient>
        <linearGradient id="wave-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8c5a12" />
          <stop offset="0.28" stopColor="#ffe9a8" />
          <stop offset="0.55" stopColor="#c98f2e" />
          <stop offset="0.8" stopColor="#ffe9a8" />
          <stop offset="1" stopColor="#9a6718" />
        </linearGradient>
      </defs>
      <path d="M0 0H400V62C372 84 340 90 306 70S244 34 196 56 108 104 64 84 18 66 0 76Z" fill="url(#wave-pink)" />
      <path d="M0 76C18 66 20 64 64 84S148 78 196 56 272 50 306 70 372 84 400 62" fill="none" stroke="url(#wave-gold)" strokeWidth="3.5" />
      <path d="M0 0H400V44C374 66 344 74 312 56S252 18 206 38 118 88 72 68 20 46 0 56Z" fill="url(#wave-choco)" />
      <path d="M0 56C20 46 26 48 72 68S160 58 206 38 280 38 312 56 374 66 400 44" fill="none" stroke="url(#wave-gold)" strokeWidth="2" />
      <path d="M8 44C40 36 52 62 88 56S140 24 184 22" fill="none" stroke="#fff0dd" strokeOpacity="0.2" strokeWidth="5" strokeLinecap="round" />
      <path d="M258 22C292 26 300 52 336 50S376 34 392 28" fill="none" stroke="#fff0dd" strokeOpacity="0.16" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/** Maré de chocolate da base: três tons de marrom com fitas rosa e dourada. */
export function ChocolateTide({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="tide-milk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9a5530" />
          <stop offset="1" stopColor="#4a2314" />
        </linearGradient>
        <linearGradient id="tide-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b321c" />
          <stop offset="1" stopColor="#2f140c" />
        </linearGradient>
        <linearGradient id="tide-dark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f1c10" />
          <stop offset="1" stopColor="#1d0e0c" />
        </linearGradient>
        <linearGradient id="tide-gold" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8c5a12" />
          <stop offset="0.3" stopColor="#ffe9a8" />
          <stop offset="0.6" stopColor="#c98f2e" />
          <stop offset="0.85" stopColor="#ffe9a8" />
          <stop offset="1" stopColor="#9a6718" />
        </linearGradient>
      </defs>
      <path d="M0 24C40 4 80 6 118 28S190 62 232 44 300 10 344 20 386 36 400 30V100H0Z" fill="url(#tide-milk)" />
      <path d="M0 24C40 4 80 6 118 28S190 62 232 44 300 10 344 20 386 36 400 30" fill="none" stroke="url(#tide-gold)" strokeWidth="1.6" />
      <path d="M0 46C46 30 90 40 132 60S214 78 256 58 330 34 400 52V66C334 50 304 62 258 76S170 90 126 76 42 48 0 64Z" fill="#e31774" />
      <path d="M0 58C46 42 90 52 132 72S214 90 256 70 330 46 400 64V100H0Z" fill="url(#tide-mid)" />
      <path d="M0 58C46 42 90 52 132 72S214 90 256 70 330 46 400 64" fill="none" stroke="url(#tide-gold)" strokeWidth="2.2" />
      <path d="M0 82C60 68 120 96 196 90S320 70 400 84V100H0Z" fill="url(#tide-dark)" />
      <path d="M22 38C52 24 78 28 102 42M262 52C292 36 318 28 346 32" fill="none" stroke="#fff0dd" strokeOpacity="0.18" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
