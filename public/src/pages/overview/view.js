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
        <button id="start-button" class="button primary" disabled title="Campaign loading starts after the private snapshot API is defined">Start campaign</button>
      </div>
    </section>
`;
