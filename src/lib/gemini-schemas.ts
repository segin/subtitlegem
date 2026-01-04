
/**
 * JSON schemas for Gemini AI structured outputs
 */

export const subtitleSchema = {
  type: "OBJECT",
  properties: {
    detectedLanguage: {
      type: "STRING",
      description: "The primary language detected in the video audio (e.g. 'English', 'Spanish', 'Japanese').",
    },
    subtitles: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          startTime: {
            type: "STRING",
            description: "Timestamp in HH:MM:SS,mmm format",
          },
          endTime: {
            type: "STRING",
            description: "Timestamp in HH:MM:SS,mmm format",
          },
          text: {
            type: "STRING",
            description: "Primary language subtitle text (transcribed)",
          },
          secondaryText: {
            type: "STRING",
            description: "Secondary language translation (if requested)",
          },
        },
        required: ["startTime", "endTime", "text"],
      },
    },
  },
  required: ["detectedLanguage", "subtitles"],
};

export const translationSchema = {
  type: "OBJECT",
  properties: {
    subtitles: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          startTime: {
            type: "STRING",
            description: "Timestamp in HH:MM:SS,mmm format",
          },
          endTime: {
            type: "STRING",
            description: "Timestamp in HH:MM:SS,mmm format",
          },
          text: {
            type: "STRING",
            description: "Original text to be translated",
          },
          secondaryText: {
            type: "STRING",
            description: "The translated text",
          },
        },
        required: ["startTime", "endTime", "text", "secondaryText"],
      },
    },
  },
  required: ["subtitles"],
};
