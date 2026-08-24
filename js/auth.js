// ============================================================================
// AetherQuest - Authentication & Cloud Save Manager
// ============================================================================

class AuthManager {
  constructor() {
    this.token = localStorage.getItem('aetherquest_token') || null;
    this.user = JSON.parse(localStorage.getItem('aetherquest_user') || 'null');
    this.isGuest = !this.token;
    this.lastSavedAt = null;
    this.isSaving = false;
  }

  async checkAuth() {
    if (!this.token) {
      this.isGuest = true;
      this.user = null;
      return false;
    }

    try {
      const res = await fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      const data = await res.json();
      if (data.ok && data.user) {
        this.user = data.user;
        this.isGuest = false;
        localStorage.setItem('aetherquest_user', JSON.stringify(this.user));
        return true;
      } else {
        this.logout(false);
        return false;
      }
    } catch (e) {
      // Offline fallback
      return !!this.user;
    }
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
      this.isGuest = false;
      localStorage.setItem('aetherquest_token', this.token);
      localStorage.setItem('aetherquest_user', JSON.stringify(this.user));
      return { ok: true, user: this.user };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async logout(callBackend = true) {
    if (callBackend && this.token) {
      try {
        await fetch('/api/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
      } catch (e) {}
    }
    this.token = null;
    this.user = null;
    this.isGuest = true;
    localStorage.removeItem('aetherquest_token');
    localStorage.removeItem('aetherquest_user');
  }

  async saveGame(saveData) {
    this.isSaving = true;
    this.updateSaveUI('Saving...');
    
    // Always persist locally
    localStorage.setItem('aetherquest_local_save', JSON.stringify(saveData));

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
        } else {
          this.updateSaveUI('Saved Locally (Cloud sync err)');
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
    if (this.token && !this.isGuest) {
      try {
        const res = await fetch('/api/save', {
          headers: { 'Authorization': `Bearer ${this.token}` }
        });
        const data = await res.json();
        if (data.ok && data.save_data) {
          // Sync local storage as well
          localStorage.setItem('aetherquest_local_save', JSON.stringify(data.save_data));
          return data.save_data;
        }
      } catch (e) {
        console.warn('Failed to load from cloud, fallback to local', e);
      }
    }

    // Fallback to local save
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
