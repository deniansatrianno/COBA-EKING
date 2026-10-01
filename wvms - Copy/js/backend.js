/* WVMS frontend/server compatibility helper. App.save lives in app.js. */
'use strict';

App.server = {
  ready: false,
  async request(action, options = {}) {
    const response = await fetch('backend/index.php?action=' + encodeURIComponent(action), {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(data.message || data.error || ('HTTP ' + response.status));
      error.status = response.status;
      throw error;
    }
    return data;
  },
  async initialize() {
    const me = await this.request('me');
    this.ready = !!me?.user;
    return me;
  },
  async load() {
    const data = await this.request('state');
    App.db = data.data;
    this.ready = true;
    return data;
  },
  save() { return App.save(); }
};

App.initServer = async () => {
  try {
    await App.server.initialize();
  } catch (error) {
    console.error('WVMS server init:', error);
  }
};
