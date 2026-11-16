---
name: brevity
description: Churchill's 1940 "Brevity" rules for written output. Use when writing or editing any report, summary, status update, PR description, commit message body, memo, handover, or agent/subagent report-back, and whenever the user asks to "make this shorter", "tighten this", "cut the waffle" or "apply brevity".
---

# Brevity

Shorter reports save the reader's time and force clearer thinking.

## Rules

1. **Lead with the main points.** First line answers "what happened / what do you need from me?" Then short, crisp paragraphs or bullets, one point each.
2. **Detail goes in an Appendix.** Long analysis, statistics, logs, tables, diffs: put them under `## Appendix` at the end, or link the file/screenshot. The body carries the conclusion, not the working.
3. **Ask: would headings do?** If the reader can ask follow-ups (chat, review, standup), prefer an aide-memoire: headings or terse bullets only, expanded on request.
4. **Cut padding.** Strike these, or replace with one word:
   - "It is worth noting that", "It should be noted that", "It is important to bear in mind" → delete
   - "In order to" → "to"; "At this point in time" → "now"; "Due to the fact that" → "because"
   - "Going forward" → delete, or "from now on"; "leverage"/"utilise" → "use"
   - "comprehensive", "robust", "seamless", "various", "key" (as filler) → delete
   - "I wanted to let you know", "Just to summarise", "As mentioned above" → delete
   - Hedging stacks ("it may potentially be possible that") → one hedge, or state it
   - Restating the question, or closing with an offer to help further → delete
5. **Plain words win.** Short, conversational phrasing is fine, even if it looks rough next to officialese.

## Before sending

- [ ] Does the first line carry the main point?
- [ ] Could any paragraph be one bullet? Any bullet be deleted?
- [ ] Is detail or data in an Appendix or link, not the body?
- [ ] Would headings alone do?
- [ ] Any phrase from rule 4 left?
- [ ] Is anything uncertain or undone stated plainly, not buried?

## Example: dashboard status update (illustrative)

Before:
> I wanted to give you a comprehensive update on the work that has been carried out in relation to the doughnut chart. It is worth noting that, in order to address the issue, we have leveraged Chart.js's built-in legend options. At this point in time, the change appears to potentially resolve the overlap on mobile devices, although it should be noted that further testing may be required going forward.

After:
> Fixed the doughnut legend overlap on mobile: moved the legend below the chart (`index.html:NNN`).
> - Verified in headless Chromium at 390px and 1440px; console clean. Screenshots in Appendix.
> - Open: not tested on Safari.

## Source

> "To do our work, we all have to read a mass of papers. Nearly all of them are far too long. This wastes time, while energy has to be spent in looking for the essential points.
> I ask my colleagues and their staffs to see to it that their Reports are shorter.
> (i) The aim should be Reports which set out the main points in a series of short, crisp paragraphs.
> (ii) If a Report relies on detailed analysis of some complicated factors, or on statistics, these should be set out in an Appendix.
> (iii) Often the occasion is best met by submitting not a full-dress Report, but an Aide-memoire consisting of headings only, which can be expanded orally if needed.
> (iv) Let us have an end of such phrases as these: 'It is also of importance to bear in mind the following considerations.....', or 'Consideration should be given to the possibility of carrying into effect.....'. Most of these woolly phrases are mere padding, which can be left out altogether, or replaced by a single word. Let us not shrink from using the short expressive phrase, even if it is conversational.
> Reports drawn up on the lines I propose may at first seem rough as compared with the flat surface of officialese jargon. But the saving in time will be great, while the discipline of setting out the real points concisely will prove an aid to clearer thinking."
>
> — Winston S. Churchill, "Brevity", War Cabinet memorandum W.P.(G)(40) 211, 9 August 1940
