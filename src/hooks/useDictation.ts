import { useState, useEffect, useCallback } from 'react';

export function useDictation() {
  const [isDictating, setIsDictating] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Create SpeechRecognition instance only once
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = 'en-US';
        
        recognitionInstance.onresult = (event: any) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        recognitionInstance.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setError(event.error);
          setIsDictating(false);
        };

        recognitionInstance.onend = () => {
          setIsDictating(false);
        };

        setRecognition(recognitionInstance);
      } else {
        setError('Speech recognition not supported in this browser.');
      }
    }
  }, []);

  const toggleDictation = useCallback(() => {
    if (!recognition) return;
    
    if (isDictating) {
      recognition.stop();
      setIsDictating(false);
    } else {
      setTranscript('');
      setError(null);
      recognition.start();
      setIsDictating(true);
    }
  }, [isDictating, recognition]);

  return {
    isDictating,
    transcript,
    toggleDictation,
    error
  };
}
