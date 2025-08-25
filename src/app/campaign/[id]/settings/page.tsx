'use client';
import { useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import LanguagePicker from '@/components/LanguagePicker';
import ModeToggle, { LLMMode } from '@/components/ModeToggle';
import RagUploader from '@/components/RagUploader';

export default function InterviewSettings() {
  const params = useParams();
  const id = String((params as any)?.id || '');

  const [settings, setSettings] = useState({
    sttLanguage: 'en-US',
    ttsVoice: 'default',
    llmMode: 'cloud' as LLMMode,
    aiInsights: true,
    jobDescription: '',
    resumeRequirements: '',
    interviewDuration: 30,
    questionCount: 8,
    studyTemplate: 'custom'
  });

  const [testMessage] = useState("Hello! This is a test of the selected voice. How does it sound to you?");
  
  // Default interview questions
  const [questions, setQuestions] = useState([
    {
      id: 1,
      category: 'INTRO',
      text: 'Give me a 30s overview of your background.',
      order: 1
    },
    {
      id: 2,
      category: 'SYSTEMS',
      text: 'How would you keep p95 <1s in a live STT to summary pipeline?',
      order: 2
    },
    {
      id: 3,
      category: 'ML',
      text: 'ARIMA vs LSTM for time-series; when does ARIMA win?',
      order: 3
    },
    {
      id: 4,
      category: 'BEHAVIORAL',
      text: 'Walk through a time you reduced latency. Baseline, actions, result.',
      order: 4
    },
    {
      id: 5,
      category: 'SYSTEMS',
      text: 'Design a system to handle 1M concurrent users with <100ms response time.',
      order: 5
    },
    {
      id: 6,
      category: 'ML',
      text: 'How would you approach building a recommendation system from scratch?',
      order: 6
    },
    {
      id: 7,
      category: 'BEHAVIORAL',
      text: 'Describe a challenging project and how you overcame obstacles.',
      order: 7
    },
    {
      id: 8,
      category: 'TECHNICAL',
      text: 'Explain the trade-offs between microservices and monoliths.',
      order: 8
    }
  ]);

  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  // Study templates with pre-built questions and follow-up rules
  const studyTemplates = {
    'product-usability': {
      name: 'Product Usability',
      description: 'Research user experience and interface effectiveness',
      questions: [
        { id: 1, category: 'INTRO', text: 'Hi, I\'m your interviewer. Ready to begin?', order: 1 },
        { id: 2, category: 'USABILITY', text: 'Walk me through the last time you used our product. What was your goal?', order: 2 },
        { id: 3, category: 'PAIN_POINTS', text: 'What was the most frustrating part of that experience?', order: 3 },
        { id: 4, category: 'FEEDBACK', text: 'If you could change one thing about the interface, what would it be?', order: 4 },
        { id: 5, category: 'COMPARISON', text: 'How does this compare to similar tools you\'ve used?', order: 5 },
        { id: 6, category: 'IMPROVEMENT', text: 'What would make you recommend this product to a colleague?', order: 6 }
      ]
    },
    'pricing-research': {
      name: 'Pricing Research',
      description: 'Understand willingness to pay and pricing sensitivity',
      questions: [
        { id: 1, category: 'INTRO', text: 'Hi, I\'m your interviewer. Ready to begin?', order: 1 },
        { id: 2, category: 'CURRENT_TOOLS', text: 'What tools do you currently use for this type of work?', order: 2 },
        { id: 3, category: 'BUDGET', text: 'What\'s your typical budget for professional tools?', order: 3 },
        { id: 4, category: 'VALUE', text: 'How much would you be willing to pay for a solution that saves you 2 hours per week?', order: 4 },
        { id: 5, category: 'FEATURES', text: 'Which features would justify a higher price point?', order: 5 },
        { id: 6, category: 'COMPETITION', text: 'How do you evaluate pricing when comparing similar products?', order: 6 }
      ]
    },
    'feature-validation': {
      name: 'Feature Validation',
      description: 'Validate new features and gather requirements',
      questions: [
        { id: 1, category: 'INTRO', text: 'Hi, I\'m your interviewer. Ready to begin?', order: 1 },
        { id: 2, category: 'WORKFLOW', text: 'Describe your current workflow for this type of task.', order: 2 },
        { id: 3, category: 'PAIN_POINTS', text: 'What\'s the biggest bottleneck in your current process?', order: 3 },
        { id: 4, category: 'SOLUTION', text: 'How would an ideal solution address that bottleneck?', order: 4 },
        { id: 5, category: 'PRIORITY', text: 'How important is solving this problem compared to other challenges?', order: 5 },
        { id: 6, category: 'ADOPTION', text: 'What would need to happen for you to adopt this new feature?', order: 6 }
      ]
    }
  };

  useEffect(() => {
    const savedSettings = localStorage.getItem(`campaign-settings-${id}`);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        
        // Load saved questions if they exist
        if (parsed.questions) {
          setQuestions(parsed.questions);
        }
      } catch (e) {
        console.error('Failed to parse saved settings:', e);
      }
    }
  }, [id]);

  const [justSaved, setJustSaved] = useState(false);

  const saveSettings = () => {
    const settingsWithQuestions = { ...settings, questions };
    localStorage.setItem(`campaign-settings-${id}`, JSON.stringify(settingsWithQuestions));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const applyStudyTemplate = (templateKey: string) => {
    if (templateKey === 'custom') return;
    const template = studyTemplates[templateKey as keyof typeof studyTemplates];
    if (template) {
      setQuestions(template.questions);
      updateSetting('questionCount', template.questions.length);
      updateSetting('studyTemplate', templateKey);
    }
  };

  const startEditingQuestion = (questionId: number, currentText: string) => {
    setEditingQuestion(questionId);
    setEditingText(currentText);
  };

  const saveQuestionEdit = (questionId: number) => {
    setQuestions(prev => prev.map(q => 
      q.id === questionId ? { ...q, text: editingText } : q
    ));
    setEditingQuestion(null);
    setEditingText('');
  };

  const cancelQuestionEdit = () => {
    setEditingQuestion(null);
    setEditingText('');
  };

  const updateQuestionCount = (newCount: number) => {
    if (newCount > questions.length) {
      // Add new questions
      const newQuestions = Array.from({ length: newCount - questions.length }, (_, i) => ({
        id: questions.length + i + 1,
        category: 'TECHNICAL',
        text: `Question ${questions.length + i + 1} - Click to edit`,
        order: questions.length + i + 1
      }));
      setQuestions([...questions, ...newQuestions]);
    } else if (newCount < questions.length) {
      // Remove questions from the end
      setQuestions(questions.slice(0, newCount));
    }
    updateSetting('questionCount', newCount);
  };

  const testVoice = (voice: string, lang: string) => {
    if ('speechSynthesis' in window) {
      // Stop any current speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(testMessage);
      
      if (voice) {
        // Use the specific selected voice
        utterance.voice = window.speechSynthesis.getVoices().find(v => v.voiceURI === voice) || null;
      }
      
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      window.speechSynthesis.speak(utterance);
    }
  };

  const testSTT = (lang: string) => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = lang;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        alert(`You said: "${transcript}" (Language: ${lang})`);
        recognition.stop();
      };

      recognition.onerror = (event: any) => {
        alert(`Speech recognition error: ${event.error}`);
        recognition.stop();
      };

      recognition.onend = () => {
        recognition.stop();
      };

      recognition.start();
      alert('Listening... Say something in ' + lang);
    } else {
      alert('Speech recognition is not supported in your browser.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 pt-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Interview Settings
          </h1>
          <p className="text-xl text-blue-200">
            Configure your campaign: <span className="font-mono text-blue-300 bg-blue-900/50 px-3 py-1 rounded-lg">{id}</span>
          </p>
          <p className="text-blue-300 text-lg">
            These settings will apply to all interviews in this campaign
          </p>
        </div>

        {/* Settings Form */}
        <div className="space-y-8">
          {/* STT/TTS Voice Settings */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-2xl">🎤</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Voice & Language Settings</h2>
                <p className="text-blue-200">Configure how the AI interviewer speaks and understands candidates</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-3">Speech Recognition (STT)</h3>
                <LanguagePicker 
                  value={settings.sttLanguage}
                  onChange={(lang) => updateSetting('sttLanguage', lang)}
                  showSTTOnly={true}
                />
                <p className="text-blue-200 text-sm">
                  Language the AI uses to understand candidate responses
                </p>
                <button
                  onClick={() => testSTT(settings.sttLanguage)}
                  className="w-full px-3 py-2 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-105 shadow-glow"
                >
                  🎤 Test Speech Recognition
                </button>
                <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <span className="text-green-400 text-lg">💡</span>
                    <div>
                      <p className="text-green-100 text-sm font-semibold mb-2">STT Testing</p>
                      <p className="text-green-200 text-sm">
                        Click the button above and speak a test phrase. The system will show you what it heard to verify the language recognition is working correctly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-3">Text-to-Speech (TTS)</h3>
                <LanguagePicker 
                  value={settings.ttsVoice}
                  onChange={(voice) => updateSetting('ttsVoice', voice)}
                  showTTSOnly={true}
                  onTestVoice={(voice, lang) => testVoice(voice, lang)}
                />
                <p className="text-blue-200 text-sm">
                  Voice and accent the AI uses to ask questions
                </p>
                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3">
                  <div className="flex items-start gap-3">
                    <span className="text-blue-400 text-lg">💡</span>
                    <div>
                      <p className="text-blue-100 text-sm font-semibold mb-2">Voice Selection Tips</p>
                      <ul className="text-blue-200 text-sm space-y-1">
                        <li>• <strong>Auto:</strong> Uses the best available voice for the selected language</li>
                        <li>• <strong>Specific voices:</strong> Choose exact voice/accent combinations</li>
                        <li>• <strong>Test button:</strong> Hear how each voice sounds before selecting</li>
                        <li>• <strong>US English:</strong> Look for voices with "en-US" language code</li>
                        <li>• <strong>UK English:</strong> Look for voices with "en-GB" language code</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Insights Configuration */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-2xl">🧠</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">AI Insights & Analysis</h2>
                <p className="text-blue-200">Configure how the AI analyzes candidate responses</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-3">Study Template</h3>
                <select 
                  value={settings.studyTemplate} 
                  onChange={(e) => applyStudyTemplate(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="custom" className="bg-slate-800 text-white">Custom Questions</option>
                  <option value="product-usability" className="bg-slate-800 text-white">Product Usability</option>
                  <option value="pricing-research" className="bg-slate-800 text-white">Pricing Research</option>
                  <option value="feature-validation" className="bg-slate-800 text-white">Feature Validation</option>
                </select>
                <p className="text-blue-200 text-sm">
                  {settings.studyTemplate !== 'custom' && studyTemplates[settings.studyTemplate as keyof typeof studyTemplates]?.description}
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-3">LLM Mode</h3>
                <ModeToggle 
                  value={settings.llmMode}
                  onChange={(mode) => {
                    const cloudOK = !!process.env.NEXT_PUBLIC_USE_CLOUD;
                    if (mode === 'cloud' && !cloudOK) {
                      try { (window as any).toast?.('Cloud mode needs API keys'); } catch {}
                      if (typeof window !== 'undefined') alert('Cloud mode needs API keys');
                      return;
                    }
                    updateSetting('llmMode', mode);
                  }}
                />
                <div className="space-y-2 text-sm">
                  <p className="text-blue-200"><strong>Local:</strong> Fast, private, limited capabilities</p>
                  <p className="text-blue-200"><strong>Cloud:</strong> Powerful, comprehensive analysis</p>
                  <p className="text-blue-200"><strong>Rules:</strong> Structured, consistent evaluation</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white mb-3">Insights Features</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 text-white">
                    <input 
                      type="checkbox" 
                      checked={settings.aiInsights}
                      onChange={(e) => updateSetting('aiInsights', e.target.checked)}
                      className="w-5 h-5 rounded border-white/20 bg-white/10 text-blue-600 focus:ring-blue-500"
                    />
                    Enable AI-powered insights
                  </label>
                  <p className="text-blue-200 text-sm">
                    AI will analyze responses and provide detailed feedback
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Job Description & Resume Requirements */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-2xl">📋</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Job Description & Requirements</h2>
                <p className="text-blue-200">Provide context for RAG and ensure factually correct AI responses</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-white font-semibold mb-3">Job Description</label>
                <textarea
                  value={settings.jobDescription}
                  onChange={(e) => updateSetting('jobDescription', e.target.value)}
                  placeholder="Enter the job description, requirements, and responsibilities..."
                  className="w-full h-32 p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-blue-200 text-sm mt-2">
                  This helps the AI understand the role and ask relevant questions
                </p>
              </div>
              
              <div>
                <label className="block text-white font-semibold mb-3">Resume Requirements & Evaluation Criteria</label>
                <textarea
                  value={settings.resumeRequirements}
                  onChange={(e) => updateSetting('resumeRequirements', e.target.value)}
                  placeholder="Specify what to look for in candidate responses, evaluation criteria, and key competencies..."
                  className="w-full h-32 p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-blue-200 text-sm mt-2">
                  Define how the AI should evaluate candidate responses
                </p>
              </div>
            </div>
          </div>

          {/* RAG Knowledge Base */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-2xl">📚</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Knowledge Base (RAG)</h2>
                <p className="text-blue-200">Upload documents to provide context for AI responses</p>
              </div>
            </div>
            
            <RagUploader onIndex={() => {}} />
            <p className="text-blue-200 text-sm mt-4">
              Upload company documents, technical specifications, or industry knowledge to enhance AI responses
            </p>
          </div>

          {/* Interview Configuration */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl flex items-center justify-center">
                <span className="text-white text-2xl">⏱️</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Interview Configuration</h2>
                <p className="text-blue-200">Set interview duration and question count</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="block text-white font-semibold mb-3">Interview Duration (minutes)</label>
                <input
                  type="number"
                  value={settings.interviewDuration}
                  onChange={(e) => updateSetting('interviewDuration', parseInt(e.target.value))}
                  min="15"
                  max="120"
                  className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-blue-200 text-sm mt-2">
                  Target duration for the complete interview
                </p>
              </div>
              
              <div>
                <label className="block text-white font-semibold mb-3">Question Count</label>
                <input
                  type="number"
                  value={settings.questionCount}
                  onChange={(e) => updateQuestionCount(parseInt(e.target.value))}
                  min="5"
                  max="15"
                  className="w-full p-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-blue-200 text-sm mt-2">
                  Number of questions to ask each candidate
                </p>
              </div>
            </div>

            {/* Question Editor */}
            <div className="mt-8">
              <h3 className="text-xl font-semibold text-white mb-6 flex items-center gap-3">
                <span className="text-yellow-400">❓</span>
                Interview Questions Editor
              </h3>
              <p className="text-blue-200 text-sm mb-6">
                Click on any question to edit it. Changes will be saved when you click "Save Campaign Settings".
              </p>
              
              <div className="space-y-4">
                {questions.map((question, index) => (
                  <div key={question.id} className="bg-slate-800/30 p-4 rounded-xl border border-slate-600">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-blue-300 text-sm font-mono bg-blue-900/50 px-2 py-1 rounded">
                          {question.category}
                        </span>
                        <span className="text-blue-200 text-sm">Question {index + 1}</span>
                      </div>
                      {editingQuestion === question.id ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveQuestionEdit(question.id)}
                            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded transition-colors"
                          >
                            ✅ Save
                          </button>
                          <button
                            onClick={cancelQuestionEdit}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                          >
                            ❌ Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditingQuestion(question.id, question.text)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                        >
                          ✏️ Edit
                        </button>
                      )}
                    </div>
                    
                    {editingQuestion === question.id ? (
                      <textarea
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        className="w-full h-24 p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Enter your question here..."
                      />
                    ) : (
                      <p className="text-white text-base leading-relaxed">{question.text}</p>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-blue-400 text-lg">💡</span>
                  <div>
                    <p className="text-blue-100 text-sm font-semibold mb-2">Question Editing Tips</p>
                    <ul className="text-blue-200 text-sm space-y-1">
                      <li>• <strong>Click Edit:</strong> Modify any question text</li>
                      <li>• <strong>Save Changes:</strong> Click the green Save button</li>
                      <li>• <strong>Cancel Edit:</strong> Click the red Cancel button to discard changes</li>
                      <li>• <strong>Question Count:</strong> Adjust the number above to add/remove questions</li>
                      <li>• <strong>Categories:</strong> Questions are organized by type (INTRO, SYSTEMS, ML, etc.)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="text-center">
          <Button 
            onClick={saveSettings}
            size="xl"
            cta="success"
            className="px-12 py-4 text-lg"
          >
            💾 Save Campaign Settings
          </Button>
          {justSaved && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-green-600/20 border border-green-500/30 text-green-200 text-sm">
              ✅ Changes saved
            </div>
          )}
          <p className="text-blue-200 text-sm mt-3">
            Settings will be applied to all future interviews in this campaign
          </p>
        </div>

        {/* Back to Dashboard */}
        <div className="text-center">
          <a 
            href={`/campaign/${id}`}
            className="inline-flex items-center gap-2 text-blue-300 hover:text-blue-200 transition-colors"
          >
            ← Back to Campaign Dashboard
          </a>
        </div>
      </main>
    </div>
  );
}
