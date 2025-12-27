// src/components/SaveLoad.ts - Client-side helpers

import { SubtitleConfig, SubtitleLine } from "@/types/subtitle";

interface ProjectFile {
    version: number;
    subtitles: SubtitleLine[];
    config: SubtitleConfig;
    secondaryLanguage: string;
}

export const saveProjectFile = (project: ProjectFile) => {
    const jsonString = JSON.stringify(project, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-${new Date().toISOString().split('T')[0]}.subtitlegem`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const loadProjectFile = (file: File): Promise<ProjectFile> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const result = event.target?.result as string;
                const project = JSON.parse(result) as ProjectFile;
                // Add validation here if needed
                if (project.version && project.subtitles && project.config) {
                    resolve(project);
                } else {
                    reject(new Error("Invalid project file structure."));
                }
            } catch (e) {
                reject(new Error("Failed to parse project file."));
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsText(file);
    });
};
