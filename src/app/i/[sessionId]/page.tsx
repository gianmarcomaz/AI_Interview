import InterviewClient from './runner-client';

export default async function Page({ 
  params, 
  searchParams 
}: { 
  params: Promise<{ sessionId: string }>, 
  searchParams: Promise<{ m?: string }> 
}) {
  // Await the params and searchParams for Next.js 15 compatibility
  const { sessionId } = await params;
  const { m } = await searchParams;
  
  // Determine initial mode on the server
  const initialMode = m === 'conversational' ? 'conversational' : 'structured';
  
  // Use ONE canonical first question text (don't let client rewrite it)
  const initialQuestionText = "Give me a 30-second overview of your background and experience.";
  
  return (
    <InterviewClient 
      sessionId={sessionId}
      initialMode={initialMode}
      initialQuestionText={initialQuestionText}
    />
  );
}
