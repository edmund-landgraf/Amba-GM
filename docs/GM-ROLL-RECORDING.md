# GM roll attribution and outcome capture

## Product boundary

AMBA GM never rolls dice and has no text entry for roll results. The game system resolves the check and tracks its mechanical effects. AMBA GM records only the narrative fact that a check occurred, who made it, and which authored degree of success applied.

For example, the GM may see a DC 18 check and its authored critical failure text. The GM handles any poison damage or condition in Foundry, Wanderer's Guide, or at the table. AMBA GM does not track damage, conditions, initiative, rounds, recovery, or combat logs.

## Interaction

The live GM workspace keeps the adventure tree on the far left. A compact party roster sits to the left of the authored encounter content. There is no separate right-side outcome panel.

The currently active authored check shows its DC and degree-of-success pills in the challenge card. A connected provider can supply the roller and degree. AMBA GM displays that roll context and lets the GM confirm the matching result by clicking its pill. The click records the campaign fact and associates the authored outcome text. There is no separate Save button.

If the provider does not supply a roller identity, the GM can choose a PC with a roster button before clicking the result. If no PC is selected, attribution defaults to **Party**. Nothing is typed.

## Provider behavior

- **Wanderer's Guide:** use its dice log to identify the roller and result where the existing interface/API exposes them. Use the log as input to the current AMBA GM check; keep only the accepted narrative result needed by the campaign.
- **Foundry:** determine which roll events and actor identity the installed Foundry/PF2e versions expose to the AMBA integration. Do not assume a stable dice log format or require the GM to copy a UUID into a journal entry. The GM's selected AMBA node supplies the narrative context.
- **Manual or physical play:** if no provider record is available, the GM can use the PC roster and degree buttons. This remains button-only and records no raw die formula or typed total.

Provider log integration may prefill a result, but the GM confirms it by clicking the outcome pill. Do not ingest or retain full dice-log transcripts.

## What the campaign record stores

Store only the accepted narrative fact and the source identity needed to find it later:

- Campaign and published source node/check identity.
- PC identity, or Party when none is selected.
- Accepted degree of success.
- Authored outcome text or the exact published revision reference.
- Timestamp and provider reference only when needed for deduplication or provenance.

A later attempt is a separate record. Do not silently replace earlier attempts. The History view supports button-driven correction or deletion. The GM can review the selected degree and authored text, then apply game mechanics in the provider.

## Explicit exclusions

- In-app dice rolling, typed results, typed notes as part of roll capture, or raw dice transcript storage.
- Damage, poison duration, conditions, HP, initiative, round tracking, or automated mechanics.
- Requiring a Foundry journal UUID to be copied back and forth.
- Automatic progression, consequences, rewards, or player reveals based only on a roll.
- A second result panel or a post-encounter questionnaire.
