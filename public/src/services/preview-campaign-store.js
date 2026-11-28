import { changeCampaign, newCampaign, validateCampaigns } from "../domain/campaigns.js";

/** In-memory campaign ledger for local UI review — nothing is sent to the GM server. */
export function previewCampaignStore() {
  let campaigns = [];
  const now = () => new Date().toISOString();
  return {
    async list() {
      return validateCampaigns(campaigns);
    },
    async create(input) {
      const result = newCampaign(campaigns, { ...input, now: now() });
      campaigns = result.campaigns;
      return result.campaign;
    },
    async change(input) {
      const result = changeCampaign(campaigns, { ...input, now: now() });
      campaigns = result.campaigns;
      return result.campaign;
    },
  };
}