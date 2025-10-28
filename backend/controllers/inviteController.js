const crypto = require('crypto');
const bcrypt = require('bcryptjs');
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

    if (!firstName || !lastName || !email || !department || !role) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (!isAllowedDomain(email)) {
      return res.status(400).json({ success: false, message: 'Email must be @buksu.edu.ph or @student.buksu.edu.ph' });
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
        department,
        role,
        isActive: false,
        status: 'pending',
        inviteToken,
        inviteTokenExpires: expires,
      });
    } else {
      user.firstName = firstName;
      user.lastName = lastName;
      user.department = department;
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
    try {
      if (emailService.sendInvitationEmail) {
        await emailService.sendInvitationEmail(user.email, {
          firstName: user.firstName,
          lastName: user.lastName,
          link
        });
      }
    } catch (e) {
      // Non-fatal; still return success so admin flow continues
      console.error('Failed to send invitation email:', e);
    }

    return res.json({ success: true, message: 'Invitation sent', inviteLink: link, userId: user._id });
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
      return res.status(400).render('invalid-invite', { message: 'Invalid or expired invitation link', layout: false });
    }
    return res.render('invite-register', { user, token, layout: false });
  } catch (err) {
    console.error('renderInvitePage error:', err);
    return res.status(500).render('invalid-invite', { message: 'Server error', layout: false });
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
      return res.status(400).render('invalid-invite', { message: 'Invalid or expired invitation link', layout: false });
    }

    user.password = await bcrypt.hash(password, 12);
    user.status = 'active';
    user.isActive = true;
    user.inviteTokenUsed = true;
    user.inviteToken = undefined;
    user.inviteTokenExpires = undefined;
    await user.save();

    return res.redirect('/?invited=1');
  } catch (err) {
    console.error('completeInvite error:', err);
    return res.status(500).render('invalid-invite', { message: 'Server error', layout: false });
  }
};

