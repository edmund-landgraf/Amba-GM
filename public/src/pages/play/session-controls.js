import { element, button } from "../../components/dom.js";
import { activeSession } from "../../domain/campaigns.js";

export function renderSessionControls(root, campaign, { start, end, history, busy }) {
  const session = activeSession(campaign);
  root.replaceChildren(element("h3", campaign.name),
    element("p", session ? "Session " + session.number + " · Active since " + new Date(session.startedAt).toLocaleString()
      : "No active session · " + campaign.sessions.length + " completed"));
  const action = session ? button("End session " + session.number, end) : button("Start session " + (campaign.sessions.length + 1), start);
  action.disabled = busy;
  root.append(action, button("Session and outcome history", history));
  if (!session) root.append(element("p", "Browse the adventure freely. Start a session to record results."));
}
