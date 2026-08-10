import { createAiRoute } from '@/lib/api/create-ai-route';
import { gradeSentenceTask } from '@/lib/ai/tasks/registry.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 25; // must match gradeSentenceTask.maxDuration — Next.js requires a literal here
export const POST = createAiRoute(gradeSentenceTask);
