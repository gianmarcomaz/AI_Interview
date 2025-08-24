'use client';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="text-center text-white p-8">
        <h1 className="text-3xl font-bold mb-2">Page not found</h1>
        <p className="text-blue-200">The page you’re looking for does not exist.</p>
      </div>
    </main>
  );
}


