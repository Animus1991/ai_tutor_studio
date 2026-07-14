export interface UploadedFile {
  id: string;
  name: string;
  extractedText: string;
  mimeType?: string;
  courseId?: string;
  pipelineVersion: string;
  createdAt: string;
}

export interface CourseTopic {
  id: string;
  title: string;
  description: string;
  objectives: string[];
  durationMinutes: number;
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface CourseSourceQuality {
  score: number;
  band: 'weak' | 'moderate' | 'strong';
  needsMoreMaterial: boolean;
  warnings: string[];
  nextActions: string[];
  recommendedTopicCount: number;
  detectedTopicCount: number;
  finalTopicCount: number;
  outlineAdjusted: boolean;
}

export interface CourseOutline {
  title: string;
  topics: CourseTopic[];
  glossary: GlossaryEntry[];
  prerequisites: string[];
}

export interface Course {
  id: string;
  title: string;
  topics: CourseTopic[];
  glossary: GlossaryEntry[];
  prerequisites: string[];
  sourceQuality?: CourseSourceQuality;
  uploadedFileIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface StudyTask {
  id: string;
  courseId: string;
  topicId: string;
  title: string;
  type: 'review' | 'lesson' | 'exam' | 'practice';
  completed: boolean;
}
