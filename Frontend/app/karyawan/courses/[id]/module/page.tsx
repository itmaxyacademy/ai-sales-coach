"use client";
import { getErrorMessage } from "@/lib/api/client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient } from "../../../../../lib/api/client";
import { ArrowLeft, BookOpen, AlertCircle } from "lucide-react";
import { AutoSkeleton } from "../../../../../components/ui";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function CourseModulePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params?.id as string;

  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    apiClient.get(`/courses/${courseId}`)
      .then(res => setCourse(res.course))
      .catch(err => setError(getErrorMessage(err, "Terjadi kesalahan.")))
      .finally(() => setLoading(false));
  }, [courseId]);

  const courseModule = course?.courseModule || course?.documents?.find((d: any) => d.category === 'module')?.content;

  if (error || (!loading && !course)) return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="card p-8 text-center">
        <AlertCircle className="w-10 h-10 text-[var(--color-danger)] mx-auto mb-3" />
        <p className="font-semibold text-[var(--color-danger)]">{error || "Course not found"}</p>
        <button onClick={() => router.back()} className="btn btn-secondary btn-sm mt-4">Go Back</button>
      </div>
    </div>
  );

  return (
    <AutoSkeleton isLoading={loading} type="course-module">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-[var(--color-border)] pb-4">
          <button onClick={() => router.back()} className="btn btn-secondary btn-sm p-2 flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-5 h-5 text-[var(--color-primary)]" />
              <h1 className="text-xl font-bold">Course Module: {course?.title}</h1>
            </div>
            <p className="text-[var(--color-text-muted)] text-sm">Study this material carefully before starting the roleplay simulation.</p>
          </div>
        </div>

        {/* Module Content - Markdown Viewer */}
        <div className="card p-8 min-h-[500px] shadow-sm">
          {!courseModule ? (
             <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)] gap-3 py-20">
               <BookOpen className="w-12 h-12 opacity-20" />
               <p>No course module available yet.</p>
             </div>
          ) : (
             <div className="w-full">
               <ReactMarkdown 
                 remarkPlugins={[remarkGfm]}
                 components={{
                   h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-[var(--color-primary)] mb-4 pb-2 border-b border-[var(--color-border)]" {...props} />,
                   h2: ({node, ...props}) => <h2 className="text-xl font-bold text-[var(--color-text)] mt-8 mb-3" {...props} />,
                   h3: ({node, ...props}) => <h3 className="text-lg font-semibold text-[var(--color-text)] mt-6 mb-2" {...props} />,
                   p: ({node, ...props}) => <p className="text-sm md:text-base text-[var(--color-text-secondary)] leading-relaxed mb-4" {...props} />,
                   ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1 text-sm md:text-base text-[var(--color-text-secondary)]" {...props} />,
                   ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1 text-sm md:text-base text-[var(--color-text-secondary)]" {...props} />,
                   li: ({node, ...props}) => <li className="pl-1" {...props} />,
                   strong: ({node, ...props}) => <strong className="font-bold text-[var(--color-text)]" {...props} />,
                   blockquote: ({node, ...props}) => (
                     <blockquote className="border-l-4 border-[var(--color-accent)] bg-[var(--color-accent)]/5 px-4 py-2 my-4 italic text-[var(--color-text-secondary)] rounded-r-lg" {...props} />
                   ),
                   a: ({node, ...props}) => <a className="text-[var(--color-primary)] hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                   code: ({node, inline, className, ...props}: any) => 
                     inline 
                       ? <code className="bg-[var(--color-surface)] text-[var(--color-accent)] px-1.5 py-0.5 rounded text-sm font-mono border border-[var(--color-border)]" {...props} />
                       : <pre className="bg-[#1e1e1e] text-white p-4 rounded-xl overflow-x-auto text-sm my-4 font-mono"><code {...props} /></pre>
                 }}
               >
                 {courseModule}
               </ReactMarkdown>
             </div>
          )}
        </div>
        
        {/* Call to Action */}
        <div className="flex justify-end pt-4">
            <Link 
              href={`/karyawan/courses/${courseId}`} 
              className="btn btn-primary px-8 py-3 flex items-center gap-2 text-sm font-semibold shadow-md"
            >
              Back & Start Roleplay
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
        </div>
      </div>
    </AutoSkeleton>
  );
}