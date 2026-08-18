import { createAiRoute } from '@/lib/api/create-ai-route';
import { suggestTopicWordsTask } from '@/lib/ai/tasks/registry.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 40; // must match suggestTopicWordsTask.maxDuration — Next.js requires a literal here
export const POST = createAiRoute(suggestTopicWordsTask);
