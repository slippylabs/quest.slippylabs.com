// ============================================================================
// AetherQuest - Authentication & Unified Cloud Save Manager
// Integrated with Slippylabs SSO (admin.slippylabs.com) & Local Auth
// ============================================================================

class AuthManager {
  constructor() {
    this.token = localStorage.getItem('aetherquest_token') || null;
    this.user = JSON.parse(localStorage.getItem('aetherquest_user') || 'null');
    this.isSso = false;
    this.isGuest = !this.token;
    this.lastSavedAt = null;
    this.isSaving = false;
  }

  async checkAuth() {
    // 1. Check Slippylabs Central SSO first (admin.slippylabs.com)
    if (window.LabAccount) {
      try {
        const ssoUser = await window.LabAccount.getUser();
        if (ssoUser && ssoUser.authenticated && ssoUser.username) {
          this.user = {
            id: ssoUser.username,
            username: ssoUser.username,
            is_admin: ssoUser.is_admin
          };
          this.isSso = true;
          this.isGuest = false;
          localStorage.setItem('aetherquest_user', JSON.stringify(this.user));
          return true;
        }
      } catch (e) {
        console.warn('SSO check error', e);
      }
    }

    // 2. Check local token if not SSO
    if (this.token) {
      try {
        const res = await fetch('/api/me', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const data = await res.json();
        if (data.ok && data.user) {
          this.user = data.user;
          this.isSso = false;
          this.isGuest = false;
          localStorage.setItem('aetherquest_user', JSON.stringify(this.user));
          return true;
        }
      } catch (e) {
        // Local offline fallback
        if (this.user) {
          this.isGuest = false;
          return true;
        }
      }
    }

    this.isGuest = true;
    this.user = null;
    return false;
  }

  async register(username, password) {
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      this.token = data.token;
      this.user = data.user;
      this.isSso = false;
      this.isGuest = false;
      localStorage.setItem('aetherquest_token', this.token);
      localStorage.setItem('aetherquest_user', JSON.stringify(this.user));
      return { ok: true, user: this.user };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async login(username, password) {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Login failed');
      }

      this.token = data.token;
      this.user = data.user;
      this.isSso = false;
      this.isGuest = false;
      localStorage.setItem('aetherquest_token', this.token);
      localStorage.setItem('aetherquest_user', JSON.stringify(this.user));
      return { ok: true, user: this.user };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async logout() {
    if (this.isSso && window.LabAccount) {
      window.LabAccount.logout();
      return;
    }

    if (this.token) {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
      } catch (e) {}
    }
    this.token = null;
    this.user = null;
    this.isSso = false;
    this.isGuest = true;
    localStorage.removeItem('aetherquest_token');
    localStorage.removeItem('aetherquest_user');
  }

  async saveGame(saveData) {
    this.isSaving = true;
    this.updateSaveUI('Saving...');
    
    // Always persist locally
    localStorage.setItem('aetherquest_local_save', JSON.stringify(saveData));

    // 1. If authenticated via Slippylabs SSO, save to Central Admin Game Saves API
    if (this.isSso && window.LabAccount) {
      try {
        const res = await window.LabAccount.saveGameData('quest', saveData);
        if (res && res.ok) {
          this.lastSavedAt = new Date();
          this.updateSaveUI('Cloud Synced ✓ (Slippylabs Account)');
          this.isSaving = false;
          return;
        }
      } catch (e) {
        console.warn('SSO cloud save error', e);
      }
    }

    // 2. If authenticated via local backend token
    if (this.token && !this.isGuest) {
      try {
        const res = await fetch('/api/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
          },
          body: JSON.stringify({ save_data: saveData })
        });
        const data = await res.json();
        if (data.ok) {
          this.lastSavedAt = new Date();
          this.updateSaveUI('Cloud Saved ✓');
          this.isSaving = false;
          return;
        }
      } catch (e) {
        this.updateSaveUI('Saved Locally (Offline)');
      }
    } else {
      this.updateSaveUI('Saved Locally (Guest)');
    }
    this.isSaving = false;
  }

  async loadGame() {
    // 1. If logged into Slippylabs SSO, load from central cloud save
    if (this.isSso && window.LabAccount) {
      try {
        const cloudSave = await window.LabAccount.loadGameSave('quest');
        if (cloudSave) {
          localStorage.setItem('aetherquest_local_save', JSON.stringify(cloudSave));
          return cloudSave;
        }
      } catch (e) {
        console.warn('Failed to load from central SSO cloud save', e);
      }
    }

    // 2. If logged in with local quest-backend token
    if (this.token && !this.isGuest) {
      try {
        const res = await fetch('/api/save', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const data = await res.json();
        if (data.ok && data.save_data) {
          localStorage.setItem('aetherquest_local_save', JSON.stringify(data.save_data));
          return data.save_data;
        }
      } catch (e) {}
    }

    // 3. Fallback to local browser save
    const local = localStorage.getItem('aetherquest_local_save');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {}
    }
    return null;
  }

  updateSaveUI(statusText) {
    const el = document.getElementById('save-status');
    if (el) {
      el.textContent = statusText;
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1000);
    }
  }
}

window.authManager = new AuthManager();
