import ChatWithData from "@/components/ChatWithData";

export default async function Page({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="frosted gradient-surface rounded-2xl p-5 border border-white/20">
          <h1 className="text-2xl md:text-3xl font-bold text-white">💬 Chat — Campaign {campaignId}</h1>
        </div>
        <ChatWithData campaignId={campaignId} />
      </main>
    </div>
  );
}
