import ReportsClient from "./ReportsClient";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const cParam = sp.c;
  const campaignId =
    typeof cParam === "string" ? cParam : Array.isArray(cParam) ? cParam[0] : undefined;

  return <ReportsClient sessionId={sessionId} campaignId={campaignId} />;
}
