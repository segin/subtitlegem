# Subtitle Timing Model

## Unified Timeline Model

**All projects use the same timeline model.** A single video = one clip that can be trimmed.

Enables:
- ✅ Trim intro/outro (remove "cut!" at end, slates at start)
- ✅ Consistent data model
- ✅ Split single video into segments

---

## Source-Relative Timing with Timeline Offset

Subtitles are stored as **absolute times within the source video**.  
When placed on a timeline, the subtitle time is **offset by the clip's timeline position**.

---

## Visual Diagram

```
SOURCE VIDEO (original.mp4)
├─────────────────────────────────────────────────────────────────────┤
0s                                                                   10min

      ┌─ Clip Start (5.0s)          ┌─ Subtitle (5.5s in source)
      │                             │
      ▼──────────────────────────── ▼ ───────────────────────────────►
      ║████████████ CLIP USED █████████████████████████████████████████║
      ├─────────────────────────────────────────────────────────────────┤
      5s                            5.5s                               30s


TIMELINE (final output)
├─────────────────────────────────────────────────────────────────────────────┤
0:00                                                                        12:00

                    ┌─ Clip placed at 8:00
                    │            ┌─ Subtitle displays at 8:00.500
                    │            │
                    ▼────────────▼─────────────────────────────────────────►
                    ║████████████ CLIP ON TIMELINE ████████████████████████║
                    ├───────────────────────────────────────────────────────┤
                   8:00        8:00.500                                   8:25
```

---

## Formula

```
Timeline Time = Timeline Clip Start + (Subtitle Source Time - Clip Source Start)
```

**Example calculation:**
| Value | Description |
|-------|-------------|
| Clip Source Start | `5.0s` (where we trim the source) |
| Subtitle Source Time | `5.5s` (timestamp in original video) |
| Timeline Clip Start | `8:00.000` (where clip is placed) |
| **Subtitle Timeline Time** | `8:00.000 + (5.5s - 5.0s) = 8:00.500` |

---

## Data Model

```typescript
interface TimelineClip {
  id: string;
  videoPath: string;
  
  // Source video timing
  sourceStart: number;   // Where clip begins in source (e.g., 5.0s)
  sourceEnd: number;     // Where clip ends in source (e.g., 30.0s)
  
  // Timeline positioning  
  timelineStart: number; // Where clip appears on timeline (e.g., 480s = 8:00)
  
  // Subtitles (stored in SOURCE time)
  subtitles: Subtitle[]; // Each subtitle.startTime is relative to source
}

// When rendering, each subtitle's display time is:
// displayTime = clip.timelineStart + (subtitle.startTime - clip.sourceStart)
```

---

## Bidirectional Formulas

### Display (Source → Timeline)
```
Timeline Time = Timeline Clip Start + (Subtitle Source Time - Clip Source Start)
```

### Edit (Timeline → Source)
When user drags subtitle handles on the timeline:
```
Source Time = (Timeline Time - Timeline Clip Start) + Clip Source Start
```

**Edit example:**
| Action | Value |
|--------|-------|
| User drags subtitle to | `8:01.000` on timeline |
| Clip Source Start | `5.0s` |
| Timeline Clip Start | `8:00.000` |
| **Stored Source Time** | `(481s - 480s) + 5.0s = 6.0s` |

> The subtitle is stored as `6.0s` in source time, NOT `8:01.000`.

---

## Key Insight

> **Subtitles never change** when you move a clip on the timeline.  
> Only the **offset calculation** changes based on `timelineStart`.

This allows:
- ✅ Non-destructive editing
- ✅ Moving clips without losing subtitle sync
- ✅ Consistent subtitle data across project saves/loads
