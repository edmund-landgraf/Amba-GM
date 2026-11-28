export const markup = `
    <section id="overview-panel" class="panel hidden" aria-labelledby="overview-title">
      <div class="overview-heading">
        <div>
          <p class="eyebrow">GM MODULE OVERVIEW</p>
          <h2 id="overview-title"></h2>
          <p id="overview-subtitle" class="muted"></p>
        </div>
        <span id="publication-status" class="status"></span>
      </div>
      <p id="overview-description" class="overview-description"></p>
      <dl id="overview-facts" class="facts"></dl>
      <div id="overview-note" class="notice"></div>
      <div class="panel-actions">
        <button id="back-button" class="button secondary">Back to modules</button>
        <button id="browse-button" class="button secondary" disabled title="Open the published tree without saving to the GM server">Browse adventure</button>
        <button id="start-button" class="button primary" disabled title="Saved campaigns require GM server storage (see .env)">Manage campaigns</button>
      </div>
    </section>
`;
