'use client';
import { useState } from 'react';
import { nanoid } from 'nanoid';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

export default function Home() {
  const [name, setName] = useState('Product Interview – Demo');
  const [objective, setObjective] = useState('Understand user pain points and latency issues');
  const [mode, setMode] = useState<'structured'|'conversational'>('structured');
  const router = useRouter();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <main className="max-w-6xl mx-auto p-6 space-y-12">
        {/* Hero Section */}
        <div className="text-center space-y-8 pt-16 animate-fade-in-up">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-8 animate-float">
            <span className="text-5xl">🎤</span>
          </div>
          <h1 className="text-6xl font-bold text-white mb-6 leading-tight">
            AI Interviewer
          </h1>
          <p className="text-2xl text-blue-200 max-w-3xl mx-auto leading-relaxed">
            Create intelligent interview campaigns with AI-powered TTS/STT. 
            No external APIs needed - everything runs in your browser.
          </p>
          <div className="flex items-center justify-center gap-4 text-blue-300 text-lg">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
              Voice-First
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
              Real-time
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              Privacy-Focused
            </span>
          </div>
        </div>

        {/* Campaign Creation Form */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-10 shadow-glow animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <span className="text-3xl">🚀</span>
            </div>
            <h2 className="text-4xl font-bold text-white mb-4">Create Your Campaign</h2>
            <p className="text-xl text-blue-200">
              Set up an interview campaign to start collecting candidate responses
            </p>
          </div>

          <div className="space-y-8 max-w-2xl mx-auto">
            <div className="space-y-3">
              <Label className="text-white text-lg font-semibold">Campaign Name</Label>
              <Input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                className="form-input h-14 text-lg"
                placeholder="e.g., Product Manager Assessment"
              />
              <p className="text-blue-200 text-base">Give your campaign a memorable name</p>
            </div>

            <div className="space-y-3">
              <Label className="text-white text-lg font-semibold">Objective</Label>
              <Input 
                value={objective} 
                onChange={e => setObjective(e.target.value)} 
                className="form-input h-14 text-lg"
                placeholder="What do you want to learn from candidates?"
              />
              <p className="text-blue-200 text-base">Describe what you're trying to achieve</p>
            </div>

            <div className="space-y-3">
              <Label className="text-white text-lg font-semibold">Interview Mode</Label>
              <Select value={mode} onValueChange={(v: string) => setMode(v as 'structured'|'conversational')}>
                <option value="">Select mode</option>
                <option value="structured">📋 Structured - Fixed question sequence</option>
                <option value="conversational">💬 Conversational - Dynamic follow-ups</option>
              </Select>
              <p className="text-blue-200 text-base">
                {mode === 'structured' 
                  ? 'Questions follow a predetermined order with optional follow-ups'
                  : 'AI adapts questions based on candidate responses'
                }
              </p>
            </div>

            <Button 
              onClick={() => {
                const id = nanoid(6);
                router.push(`/campaign/${id}?m=${mode}`);
              }}
              className="w-full h-16 text-xl font-semibold rounded-2xl shadow-glow-hover"
              cta="success"
              shadow
            >
              🚀 Create Campaign & Continue
            </Button>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mt-16 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8 text-center card-hover group">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
              <span className="text-4xl">🎤</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Voice-First</h3>
            <p className="text-blue-200 text-base leading-relaxed">AI speaks questions, candidates respond naturally with real-time transcription</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8 text-center card-hover group">
            <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
              <span className="text-4xl">🔗</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Easy Sharing</h3>
            <p className="text-blue-200 text-base leading-relaxed">Generate unique links for each candidate with one-click campaign management</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8 text-center card-hover group">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-500">
              <span className="text-4xl">📊</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-4">Real-time Insights</h3>
            <p className="text-blue-200 text-base leading-relaxed">Live transcript with timestamps and AI-powered response analysis</p>
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-white/10 backdrop-blur-lg rounded-3xl border border-white/20 p-10 shadow-glow animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
          <h3 className="text-3xl font-bold text-white mb-10 text-center">How It Works</h3>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">1</div>
              <h4 className="text-white font-semibold text-lg mb-3">Create Campaign</h4>
              <p className="text-blue-200 text-base leading-relaxed">Set up your interview with name, objective, and question mode</p>
            </div>
            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white font-bold mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">2</div>
              <h4 className="text-white font-semibold text-lg mb-3">Share Links</h4>
              <p className="text-blue-200 text-base leading-relaxed">Generate unique URLs for each candidate with bulk CSV upload</p>
            </div>
            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center text-white font-bold mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">3</div>
              <h4 className="text-white font-semibold text-lg mb-3">Run Interviews</h4>
              <p className="text-blue-200 text-base leading-relaxed">AI conducts voice-based interviews with real-time transcription</p>
            </div>
            <div className="text-center group">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center text-white font-bold mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">4</div>
              <h4 className="text-white font-semibold text-lg mb-3">Get Results</h4>
              <p className="text-blue-200 text-base leading-relaxed">Review transcripts, insights, and generate detailed reports</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center space-y-6 animate-fade-in-up" style={{ animationDelay: '0.8s' }}>
          <h3 className="text-3xl font-bold text-white">Ready to Get Started?</h3>
          <p className="text-xl text-blue-200">Create your first AI interview campaign in minutes</p>
          <Button 
            onClick={() => {
              const id = nanoid(6);
              router.push(`/campaign/${id}?m=structured`);
            }}
            className="h-16 px-12 text-xl font-semibold rounded-2xl shadow-glow-hover"
            cta="primary"
            shadow
          >
            🚀 Start Creating
          </Button>
        </div>
      </main>
    </div>
  );
}
