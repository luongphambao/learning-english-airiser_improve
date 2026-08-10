import { createAiRoute } from '@/lib/api/create-ai-route';
import { extractWordsTask } from '@/lib/ai/tasks/registry.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 25; // must match extractWordsTask.maxDuration — Next.js requires a literal here
export const POST = createAiRoute(extractWordsTask);
