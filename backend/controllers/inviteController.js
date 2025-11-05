const crypto = require('crypto');
const User = require('../models/User');
const emailService = require('../services/emailService');

function isAllowedDomain(email) {
  const lower = String(email || '').toLowerCase();
  return lower.endsWith('@buksu.edu.ph') || lower.endsWith('@student.buksu.edu.ph');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

exports.inviteUser = async (req, res) => {
  try {
    const { firstName, lastName, email, department, role } = req.body || {};

    // Validation: department is required only for non-admin roles
    if (!firstName || !lastName || !email || !role) {
      return res.status(400).json({ success: false, message: 'First name, last name, email, and role are required' });
    }
    if (role !== 'admin' && !department) {
      return res.status(400).json({ success: false, message: 'Department is required for secretaries and faculty' });
    }
    if (!isAllowedDomain(email)) {
      return res.status(400).json({ success: false, message: 'Email must be @buksu.edu.ph or @student.buksu.edu.ph' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    // Abstract Email validation - BEFORE database check
    try {
      const { validateEmailDeliverability } = require('../services/emailValidationService');
      const validation = await validateEmailDeliverability(email.toLowerCase());
      console.log('[INVITE CONTROLLER] Validation result:', { email, usable: validation.usable, reason: validation.reason });
      if (!validation.usable) {
        return res.status(400).json({
          success: false,
          message: 'Email appears undeliverable. Please verify address.',
          validationReason: validation.reason
        });
      }
    } catch (e) {
      console.error('Email validation service error:', e.message);
      // Continue on validation errors - let it through with warning
    }

    let user = await User.findOne({ email: email.toLowerCase() });
    if (user && user.status === 'active') {
      return res.status(409).json({ success: false, message: 'User already exists and is active' });
    }

    const inviteToken = generateToken();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    if (!user) {
      user = await User.create({
        firstName,
        lastName,
        email: email.toLowerCase(),
        department: role === 'admin' ? '' : department, // Admins cannot have departments
        role,
        isActive: false,
        status: 'pending',
        inviteToken,
        inviteTokenExpires: expires,
      });
    } else {
      user.firstName = firstName;
      user.lastName = lastName;
      user.department = role === 'admin' ? '' : department; // Admins cannot have departments
      user.role = role;
      user.isActive = false;
      user.status = 'pending';
      user.inviteToken = inviteToken;
      user.inviteTokenExpires = expires;
      user.inviteTokenUsed = false;
      await user.save();
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
    const link = `${baseUrl}/invite/${inviteToken}`;

    // Send invite email
    let emailSent = false;
    try {
      if (emailService.sendInvitationEmail) {
        const emailResult = await emailService.sendInvitationEmail(user.email, {
          firstName: user.firstName,
          lastName: user.lastName,
          link
        });
        emailSent = emailResult && emailResult.success !== false;
        if (!emailSent) {
          console.warn('Invitation email may have failed:', emailResult);
        }
      }
    } catch (e) {
      console.error('Failed to send invitation email:', e);
      // Still return success with warning - email might bounce later
      return res.json({
        success: true,
        message: 'User created but email delivery may have failed. Check server logs.',
        inviteLink: link,
        userId: user._id,
        emailWarning: true
      });
    }

    return res.json({
      success: true,
      message: emailSent ? 'Invitation sent successfully' : 'Invitation created but email may not have been delivered',
      inviteLink: link,
      userId: user._id
    });
  } catch (err) {
    console.error('inviteUser error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.renderInvitePage = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await User.findOne({ inviteToken: token, inviteTokenUsed: { $ne: true } });
    if (!user || !user.inviteTokenExpires || user.inviteTokenExpires < new Date()) {
      return res.status(400).render('invalid-invite', { message: 'This invitation link is invalid or has expired.', layout: false });
    }
    return res.render('invite-register', { user, token, layout: false });
  } catch (err) {
    console.error('renderInvitePage error:', err);
    return res.status(500).render('login', {
      showMessageModal: true,
      modalTitle: 'Server Error',
      modalMessage: 'Unable to process the invitation link. Please try again later.',
      modalType: 'error'
    });
  }
};

exports.completeInvite = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body || {};
    if (!token || !password || !confirmPassword) {
      return res.status(400).render('invalid-invite', { message: 'Missing fields', layout: false });
    }
    if (password !== confirmPassword) {
      const user = await User.findOne({ inviteToken: token, inviteTokenUsed: { $ne: true } });
      return res.status(400).render('invite-register', { error: 'Passwords do not match', token, user, layout: false });
    }

    const user = await User.findOne({ inviteToken: token, inviteTokenUsed: { $ne: true } });
    if (!user || !user.inviteTokenExpires || user.inviteTokenExpires < new Date()) {
      return res.status(400).render('invalid-invite', { message: 'This invitation link is invalid or has expired.', layout: false });
    }

    // Set plain password - User model's pre-save hook will hash it automatically
    user.password = password;
    user.status = 'active';
    user.isActive = true;
    user.inviteTokenUsed = true;
    user.inviteToken = undefined;
    user.inviteTokenExpires = undefined;
    await user.save();

    return res.redirect('/?invited=1');
  } catch (err) {
    console.error('completeInvite error:', err);
    return res.status(500).render('login', {
      showMessageModal: true,
      modalTitle: 'Server Error',
      modalMessage: 'Unable to complete registration. Please try again later.',
      modalType: 'error'
    });
  }
};

