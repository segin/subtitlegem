
import fs from 'fs';
import path from 'path';
import { getStagingDir } from './storage-config';
import { generateSummary } from './gemini';
import { SubtitleLine } from '@/types/subtitle';

/**
 * Metadata structure stored in storage/metadata/{id}.json
 */
export interface ProjectMetadata {
  summary?: string;
  metrics?: {
    sourceSize: number;
    renderedSize: number;
    sourceCount: number;
    subtitleCount: number;
    renderCount: number;
    lifetimeRenderCount: number;
  };
  lastUpdated?: number;
}

/**
 * Get the path to the project metadata file
 */
export function getMetadataPath(draftId: string): string {
  const stagingDir = getStagingDir();
  const metadataDir = path.join(stagingDir, 'metadata');
  if (!fs.existsSync(metadataDir)) {
    fs.mkdirSync(metadataDir, { recursive: true });
  }
  return path.join(metadataDir, `${draftId}.json`);
}

/**
 * Read project metadata from disk
 */
export function getProjectMetadata(draftId: string): ProjectMetadata {
  try {
    const metaPath = getMetadataPath(draftId);
    if (fs.existsSync(metaPath)) {
      return JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    }
  } catch (error) {
    console.error(`[SummaryGenerator] Failed to read metadata for ${draftId}`, error);
  }
  return {};
}

/**
 * Save project metadata to disk
 */
export function saveProjectMetadata(draftId: string, metadata: ProjectMetadata): void {
  try {
    const metaPath = getMetadataPath(draftId);
    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error(`[SummaryGenerator] Failed to save metadata for ${draftId}`, error);
  }
}

/**
 * Generate a short summary for a project based on its subtitles
 * @param draftId Project ID
 * @param subtitles Subtitles array (first 100-200 lines used)
 * @param forceRegenerate Ignore existing summary
 */
export async function generateProjectSummary(
  draftId: string, 
  subtitles: SubtitleLine[], 
  forceRegenerate = false
): Promise<string | null> {
  const metadata = getProjectMetadata(draftId);

  // Return cached if exists and not forced
  if (metadata.summary && !forceRegenerate) {
    return metadata.summary;
  }

  if (!subtitles || subtitles.length === 0) {
    return null;
  }

  // Extract context (first 100 lines usually enough for topic)
  const contextLines = subtitles.slice(0, 100).map(s => s.text).join(' ');
  
  if (contextLines.length < 50) {
    return null; // Not enough content
  }

  try {
    const systemPrompt = `Summarize the following video transcript in 10 words or less. 
    Focus on the topic and content. Do not say "The video talks about". Direct description only.
    
    Transcript:
    ${contextLines}`;

    const summary = await generateSummary(systemPrompt);

    if (summary) {
      const cleanSummary = summary.trim().replace(/\.$/, '');
      
      // Save to metadata
      saveProjectMetadata(draftId, {
        ...metadata,
        summary: cleanSummary,
        lastUpdated: Date.now()
      });
      
      return cleanSummary;
    }
  } catch (error) {
    console.error(`[SummaryGenerator] AI generation failed for ${draftId}`, error);
  }

  return null;
}
