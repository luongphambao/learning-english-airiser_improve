import { createAiRoute } from '@/lib/api/create-ai-route';
import { enrichWordBatchTask } from '@/lib/ai/tasks/registry.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // must match enrichWordBatchTask.maxDuration — Next.js requires a literal here
export const POST = createAiRoute(enrichWordBatchTask);
