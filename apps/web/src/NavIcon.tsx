export function NavIcon({ name }: { name: 'overview' | 'plan' | 'charts' }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === 'overview' ? (
        <>
          <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
        </>
      ) : name === 'plan' ? (
        <>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1m-8 3h1" />
        </>
      ) : (
        <>
          <path d="M4 3v17h17M7 14l4-5 4 3 5-7" />
        </>
      )}
    </svg>
  );
}
