import VideoViewer from "@/components/VideoViewer";

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="frosted gradient-surface shadow-glow rounded-2xl p-5 border border-white/20">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">📺</span>
              Watch Session
              <span className="font-mono text-white/90 bg-blue-900/40 px-2.5 py-1 rounded-md border border-white/10 text-sm">
                {sessionId}
              </span>
            </h1>
            <div className="hidden md:flex items-center gap-2 text-xs text-blue-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live
            </div>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/20 overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">Remote Stream</h3>
          </div>
          <div className="p-4">
            <VideoViewer sessionId={sessionId} />
          </div>
        </div>
      </main>
    </div>
  );
}
