import { useState } from 'react';
import StudyWorkspace from '../components/workspace/StudyWorkspace';
import UploadCourseModal from '../components/UploadCourseModal';

export default function StudyWorkspacePage() {
  const [uploadOpen, setUploadOpen] = useState(false);
  return (
    <>
      <StudyWorkspace onRequestUpload={() => setUploadOpen(true)} />
      <UploadCourseModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  );
}
