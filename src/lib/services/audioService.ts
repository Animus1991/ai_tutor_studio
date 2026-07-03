export async function summarizeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'note.webm');
  
  const res = await fetch('/api/summarize-audio', {
    method: 'POST',
    body: formData
  });
  
  if (!res.ok) {
    throw new Error('Failed to summarize audio via backend API');
  }
  
  const data = await res.json();
  return data.summary || '';
}
