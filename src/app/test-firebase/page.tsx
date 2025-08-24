'use client';
import { useEffect, useState } from 'react';
import { getFirebase, signalingAvailable } from '@/lib/firebase/client';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

export default function TestFirebase() {
  const [status, setStatus] = useState<string>('Testing...');
  const [details, setDetails] = useState<string[]>([]);
  const [envVars, setEnvVars] = useState<Record<string, string>>({});

  useEffect(() => {
    async function testFirebase() {
      const results: string[] = [];
      
      try {
        // Check environment variables
        const vars = {
          'NEXT_PUBLIC_FIREBASE_API_KEY': process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'NOT SET',
          'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN': process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'NOT SET',
          'NEXT_PUBLIC_FIREBASE_PROJECT_ID': process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET',
          'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET': process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'NOT SET',
          'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID': process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'NOT SET',
          'NEXT_PUBLIC_FIREBASE_APP_ID': process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'NOT SET',
        };
        
        setEnvVars(vars);
        
        // Check if variables are set
        const missingVars = Object.entries(vars).filter(([_, value]) => value === 'NOT SET');
        if (missingVars.length > 0) {
          results.push(`❌ Missing environment variables: ${missingVars.map(([key]) => key).join(', ')}`);
        } else {
          results.push('✅ All Firebase environment variables are set');
        }
        
        // Test signaling availability
        const hasSignaling = signalingAvailable();
        if (hasSignaling) {
          results.push('✅ Firebase signaling is available');
        } else {
          results.push('❌ Firebase signaling is not available');
        }
        
        // Test Firebase connection
        if (hasSignaling) {
          try {
            const { db } = getFirebase();
            results.push('✅ Firebase connection successful');
            
            // Test Firestore write
            const testRef = doc(db, 'test', 'connection-test');
            await setDoc(testRef, { timestamp: new Date(), test: true });
            results.push('✅ Firestore write test successful');
            
            // Clean up test document
            await deleteDoc(testRef);
            results.push('✅ Firestore cleanup successful');
            
          } catch (error: any) {
            results.push(`❌ Firebase connection failed: ${error.message}`);
          }
        }
        
        // Check browser compatibility
        if (typeof window !== 'undefined') {
          if ('RTCPeerConnection' in window) {
            results.push('✅ WebRTC is supported');
          } else {
            results.push('❌ WebRTC is not supported');
          }
          
          if ('mediaDevices' in navigator) {
            results.push('✅ Media devices are supported');
          } else {
            results.push('❌ Media devices are not supported');
          }
          
          if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            results.push('✅ Speech recognition is supported');
          } else {
            results.push('❌ Speech recognition is not supported');
          }
        }
        
        setStatus('Test completed');
        
      } catch (error: any) {
        results.push(`❌ Test failed: ${error.message}`);
        setStatus('Test failed');
      }
      
      setDetails(results);
    }
    
    testFirebase();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <main className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="text-center space-y-4 pt-8">
          <h1 className="text-4xl font-bold text-white">Firebase Configuration Test</h1>
          <p className="text-xl text-blue-200">Testing your Firebase setup for video streaming</p>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Test Status: {status}</h2>
          
          <div className="space-y-4">
            {details.map((detail, index) => (
              <div key={index} className="p-3 bg-white/5 rounded-lg border border-white/10">
                <p className="text-white">{detail}</p>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Environment Variables</h2>
          <div className="space-y-2">
            {Object.entries(envVars).map(([key, value]) => (
              <div key={key} className="flex justify-between items-center p-2 bg-white/5 rounded">
                <span className="text-blue-200 text-sm">{key}</span>
                <span className={`text-sm font-mono ${
                  value === 'NOT SET' ? 'text-red-400' : 'text-green-400'
                }`}>
                  {value === 'NOT SET' ? 'NOT SET' : value.substring(0, 20) + '...'}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-blue-400 text-lg">💡</span>
            <div>
              <p className="text-blue-100 text-sm font-semibold mb-2">Next Steps</p>
              <ul className="text-blue-200 text-sm space-y-1">
                <li>• If any tests failed, check your Firebase configuration</li>
                <li>• Ensure all environment variables are set in .env.local</li>
                <li>• Restart your development server after changing .env.local</li>
                <li>• Check Firebase Console for any permission issues</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
