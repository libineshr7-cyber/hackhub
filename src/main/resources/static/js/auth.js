/* ==========================================================================
   HackHub — Authentication & Profile Handler
   ========================================================================== */

const Auth = {
  showLoginModal() {
    App.openModal('modal-login');
  },

  showFirstLoginModal() {
    App.openModal('modal-first-login');
  },

  async handleLogin(event) {
    event.preventDefault();
    const regNo = document.getElementById('login-reg-no').value.trim();
    const password = document.getElementById('login-password').value;

    if (!regNo || !password) {
      App.showToast('Please enter registration number and password.', 'danger');
      return;
    }

    try {
      const data = await API.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ registrationNumber: regNo, password: password })
      });

      API.setToken(data.token);
      API.setUser({
        id: data.id,
        registrationNumber: data.registrationNumber,
        name: data.name,
        email: data.email,
        role: data.role,
        firstLogin: data.firstLogin,
        skills: data.skills
      });

      App.closeModal('modal-login');
      App.showToast(`Welcome back, ${data.name}!`, 'success');
      App.updateUserUI(data);

      if (data.firstLogin) {
        this.showFirstLoginModal();
      } else {
        App.navigateTo('home');
      }
    } catch (err) {
      App.showToast(err.message || 'Login failed', 'danger');
    }
  },

  async handleFirstLoginPasswordChange(event) {
    event.preventDefault();
    const currentPassword = document.getElementById('first-current-password').value;
    const newPassword = document.getElementById('first-new-password').value;

    if (!currentPassword || !newPassword) {
      App.showToast('Please fill in both password fields.', 'danger');
      return;
    }

    if (newPassword.length < 4) {
      App.showToast('New password must be at least 4 characters.', 'danger');
      return;
    }

    if (newPassword === '123') {
      App.showToast('New password cannot be the same as the temporary password.', 'danger');
      return;
    }

    try {
      const response = await API.request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const user = API.getUser();
      if (user) {
        user.firstLogin = false;
        API.setUser(user);
      }

      App.closeModal('modal-first-login');
      App.showToast(response.message || 'Password updated successfully!', 'success');
      // Push state so back button cannot return to pre-password-change state
      history.pushState({ spa: true, authed: true }, '', window.location.pathname);
      App.navigateTo('home');
    } catch (err) {
      App.showToast(err.message || 'Password change failed. Check your current password.', 'danger');
    }
  },

  showForgotPasswordModal() {
    document.getElementById('otp-step-1').style.display = 'block';
    document.getElementById('otp-step-2').style.display = 'none';
    const regInput = document.getElementById('otp-reg-no');
    const otpInput = document.getElementById('otp-code-input');
    const passInput = document.getElementById('otp-new-password');
    if (regInput) regInput.value = '';
    if (otpInput) otpInput.value = '';
    if (passInput) passInput.value = '';
    App.openModal('modal-forgot-password');
  },

  async handleRequestOtp(event) {
    event.preventDefault();
    const regNo = document.getElementById('otp-reg-no').value.trim();
    if (!regNo) {
      App.showToast('Please enter your registration number.', 'danger');
      return;
    }

    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerHTML : 'Send 6-Digit Gmail OTP';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Sending OTP to Gmail...';
    }

    try {
      const res = await API.request('/auth/forgot-password/request-otp', {
        method: 'POST',
        body: JSON.stringify({ registrationNumber: regNo })
      });

      document.getElementById('otp-step-1').style.display = 'none';
      document.getElementById('otp-step-2').style.display = 'block';
      App.showToast(res.message, 'success');
    } catch (err) {
      App.showToast(err.message || 'Failed to request OTP', 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  },

  async handleVerifyOtpAndResetPassword(event) {
    event.preventDefault();
    const regNo = document.getElementById('otp-reg-no').value.trim();
    const otp = document.getElementById('otp-code-input').value.trim();
    const newPassword = document.getElementById('otp-new-password').value;

    if (!otp || !newPassword) {
      App.showToast('Please enter OTP and new password.', 'danger');
      return;
    }

    const btn = event.target.querySelector('button[type="submit"]');
    const originalText = btn ? btn.innerHTML : 'Verify OTP & Set New Password';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Verifying OTP...';
    }

    try {
      const res = await API.request('/auth/forgot-password/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ registrationNumber: regNo, otp: otp, newPassword: newPassword })
      });

      App.closeModal('modal-forgot-password');
      App.showToast(res.message, 'success');
      this.showLoginModal();
    } catch (err) {
      App.showToast(err.message || 'OTP verification failed', 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  },

  async loadProfile() {
    try {
      const user = await API.request('/user/profile');
      document.getElementById('profile-reg-no').textContent = user.registrationNumber;
      document.getElementById('profile-name-input').value = user.name || '';
      document.getElementById('profile-email-input').value = user.email || '';
      document.getElementById('profile-skills-input').value = user.skills || '';
      document.getElementById('profile-role').textContent = user.role === 'ROLE_ADMIN' ? 'Department Admin' : 'Student';
    } catch (err) {
      App.showToast('Failed to load profile', 'danger');
    }
  },

  async handleUpdateProfile(event) {
    event.preventDefault();
    const name = document.getElementById('profile-name-input').value.trim();
    const email = document.getElementById('profile-email-input').value.trim();
    const skills = document.getElementById('profile-skills-input').value.trim();

    try {
      const updatedUser = await API.request('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, email, skills })
      });

      const cached = API.getUser();
      if (cached) {
        cached.name = updatedUser.name;
        cached.email = updatedUser.email;
        cached.skills = updatedUser.skills;
        API.setUser(cached);
      }

      App.showToast('Profile updated successfully!', 'success');
    } catch (err) {
      App.showToast(err.message || 'Profile update failed', 'danger');
    }
  },

  logout() {
    API.clearToken();
    App.showToast('Logged out successfully.', 'info');
    window.location.reload();
  }
};
