import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <h1 className="text-6xl font-bold text-zinc-900 dark:text-zinc-100">404</h1>
      <h2 className="text-2xl font-semibold mt-4 text-zinc-800 dark:text-zinc-200">Page Not Found</h2>
      <p className="mt-4 text-zinc-600 dark:text-zinc-400 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link 
        href="/" 
        className="mt-8 px-4 py-2 rounded-md bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}