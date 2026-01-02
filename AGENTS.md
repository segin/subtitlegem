# AGENTS.md

> **This is a living document.** AI agents should keep this file and [ARCHITECTURE.md](./ARCHITECTURE.md) updated as the codebase evolves.

## Project Overview

SubtitleGem is an AI-powered subtitle generation application using Google's Gemini API. For detailed architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md). For project introduction, see [README.md](./README.md).

## Architecture Maintenance

> [!IMPORTANT]
> **All AI agents must read and maintain [ARCHITECTURE.md](./ARCHITECTURE.md).**
> 
> When making changes that affect:
> - Project structure or new files/directories
> - API endpoints or data flows
> - External integrations or dependencies
> - Database schemas or storage patterns
> 
> Update `ARCHITECTURE.md` accordingly. Keep the "Date of Last Update" current.

## Setup Commands

```bash
# Install dependencies
npm install

# Run development server (default port 3050)
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Production build
npm run build
```

## Code Style Guidelines

### TypeScript
- **Strict mode enabled** - No `any` types without justification
- **Functional patterns preferred** - Use React hooks, avoid class components
- **Async/await** over `.then()` chains

### Naming Conventions
- **Files:** `kebab-case.ts` for utilities, `PascalCase.tsx` for components
- **Variables/Functions:** `camelCase`
- **Types/Interfaces:** `PascalCase`
- **Constants:** `SCREAMING_SNAKE_CASE`

### React Components
- Use function components with TypeScript interfaces for props
- Colocate hooks in `src/hooks/`
- Keep components focused and composable

### API Routes
- Place in `src/app/api/{endpoint}/route.ts`
- Use Next.js App Router conventions
- Return proper HTTP status codes

## Testing Instructions

- **Framework:** Jest
- **Test files:** `*.test.ts` adjacent to source files in `src/lib/`
- **Run:** `npm test`
- **Coverage:** Focus on utility functions in `src/lib/`

When adding new functionality:
1. Add tests for utility functions
2. Ensure existing tests pass
3. Test video processing manually with sample files
4. Mock external services (e.g. Gemini) to verify handling of API responses and errors

## File Structure Reference

```
src/
├── app/           # Next.js App Router (pages + API routes)
├── components/    # React UI components
├── lib/           # Core business logic (testable utilities)
├── hooks/         # Custom React hooks
└── types/         # TypeScript type definitions
```

## Security Considerations

> [!CAUTION]
> This application is designed for single-user/trusted network deployment. Do NOT expose to public internet without additional security measures.

- **No authentication** - Use behind firewall/VPN
- **API keys** - Stored in `.env` file (never commit)
- **File access** - Restricted to `STAGING_DIR` path
- **Path validation** - Always sanitize file paths to prevent traversal attacks

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `GEMINI_API_KEY` | Google Gemini API authentication | Yes |
| `STAGING_DIR` | Root directory for file storage | No (defaults to `./storage`) |

## Dependencies

- **FFmpeg** - Must be installed on system for video processing
- **Node.js 20+** - Required runtime
- **Noto Sans CJK** - Recommended for Chinese subtitle rendering
