# GM roll attribution and outcome capture

## Interaction

The live GM workspace keeps the adventure tree on the far left. In the selected encounter, show the party roster in a compact left-side pane beside the authored content. Do not reserve a right-side panel for recording outcomes.

For a published challenge, the degree-of-success pills remain in the authored challenge card. The GM selects the PC who rolled, then clicks the result that actually occurred. That click records the challenge result and attaches the corresponding authored outcome text to the campaign record. There is no second Save button or separate result panel.

## Roller attribution

The roster source follows the GM's party setup: Wanderer's Guide, Foundry, or AMBA pregenerated PCs. The selected PC is visibly highlighted.

If no PC is selected, attribute the roll to **Party**. Party is the default state. The GM can change the selected PC before recording another result.

The app records attribution only after the GM clicks an outcome. Merely opening the challenge, rolling in an external tool, or viewing the result table does not create a campaign record.

## Records, retries, and corrections

Each click records one actual check attempt with the campaign, source module revision, stable challenge/check identifier, degree, selected PC or Party, authored outcome text, provider metadata when available, and timestamp.

A later attempt creates a separate record; it does not silently overwrite an earlier attempt. The History view lets the GM edit or remove a mistaken record. The encounter view shows the latest accepted state while retaining the attempt history.

When a provider supplies a correlated result, AMBA GM may prefill the degree and roller, but the GM still confirms by clicking the matching outcome pill. Manual entry remains available when no provider is connected.

## Scope limits

- This records authored challenge outcomes for narrative and campaign memory.
- It does not store a combat transcript or track initiative, HP, conditions, damage, or other combat state.
- It does not infer a discovery or apply a later consequence solely from a roll. Only the selected authored outcome text is recorded.
- It does not require a right-side event panel or post-encounter questionnaire.
