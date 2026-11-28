import { element, button } from "../../components/dom.js";
import { activeSession } from "../../domain/campaigns.js";

export function renderSessionControls(root, campaign, { start, end, busy, revision }) {
  const session = activeSession(campaign);
  root.replaceChildren(element("h3", campaign.name));
  if (revision) root.append(element("p", "Publication · " + revision));
  root.append(element("p", session ? "Session " + session.number + " · Active since " + new Date(session.startedAt).toLocaleString()
    : "No active session · " + campaign.sessions.length + " completed"));
  const action = session ? button("End session " + session.number, end) : button("Start session " + (campaign.sessions.length + 1), start);
  action.disabled = busy;
  action.className = session ? "button secondary" : "button primary";
  root.append(action);
  if (!session) root.append(element("p", "Browse the adventure freely. Start a session to record results."));
}
