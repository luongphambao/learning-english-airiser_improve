import { createAiRoute } from '@/lib/api/create-ai-route';
import { analyzeDocumentTask } from '@/lib/ai/tasks/registry.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 80; // must match analyzeDocumentTask.maxDuration — Next.js requires a literal here
export const POST = createAiRoute(analyzeDocumentTask);
