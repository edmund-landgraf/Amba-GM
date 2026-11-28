export const markup = `
    <section id="connect-panel" class="panel">
      <div class="panel-copy">
        <p class="eyebrow">AMBA ACCOUNT</p>
        <h2>Connect to your AMBA modules</h2>
        <p>AMBA GM uses your existing AMBA sign-in. It does not ask for or store your password.</p>
      </div>
      <button id="connect-button" class="button primary">Connect to AMBA</button>
    </section>
    <section id="module-panel" class="panel hidden" aria-labelledby="module-heading">
      <div class="panel-copy">
        <p class="eyebrow">YOUR MODULES</p>
        <h2 id="module-heading">Choose an adventure to run</h2>
        <p>Play Now lists published modules with a full syndication. Drafts stay in Authoring.</p>
      </div>
      <div id="module-list" class="module-list"></div>
      <div id="module-card" class="module-card hidden"></div>
      <div class="panel-actions">
        <button id="refresh-button" class="button secondary">Refresh list</button>
        <button id="open-overview-button" class="button primary" disabled>Open GM overview</button>
      </div>
    </section>
`;
