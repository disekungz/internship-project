// ==========================================
// Middleware & Router สำหรับจัดการสิทธิ์ผู้ดูแลระบบ (Admin Auth)
// - ตรวจสอบสิทธิ์การเข้าถึง API ที่ต้องใช้สิทธิ์ Admin เช่น Import / Delete
// - ออก JWT Token (HMAC SHA-256) โดยใช้ตาราง register_admin_users
// ==========================================
const express = require('express');
const crypto = require('crypto');
const { pool_test } = require('../../../../config.js');

const router = express.Router();
const secret = process.env.MANHOUR_AUTH_SECRET || '';

// สร้างลายเซ็น Token (HMAC SHA-256)
const sign = value => crypto.createHmac('sha256', secret).update(value).digest('base64url');

async function adminLogin(req, res) {
  const inputUsername = String(req.body?.username || '').trim();
  const inputPassword = String(req.body?.password || '');

  if (!inputUsername || !inputPassword)
    return res.status(400).json({ error: 'Username and password are required' });

  try {
    // ค้นหาผู้ใช้จากตาราง register_admin_users
    const result = await pool_test.query(
      `SELECT id, username, password, display_name, role, is_active
       FROM register_admin_users
       WHERE username = $1`,
      [inputUsername]
    );

    console.log('[Auth] Query result rows:', result.rows.length);
    if (result.rows[0]) {
      const u = result.rows[0];
      console.log('[Auth] Found user:', u.username, '| is_active:', u.is_active, '| pw match:', u.password === inputPassword);
    } else {
      console.log('[Auth] No user found for username:', inputUsername);
    }

    const user = result.rows[0];

    // ตรวจสอบ is_active
    if (!user || !user.is_active)
      return res.status(401).json({ error: 'Invalid admin credentials' });

    // ตรวจสอบ password (plain text)
    if (user.password !== inputPassword)
      return res.status(401).json({ error: 'Invalid admin credentials' });

    // อัพเดต last_login
    await pool_test.query(
      `UPDATE register_admin_users SET last_login = NOW() WHERE id = $1`,
      [user.id]
    );

    // ออก Token
    const payload = Buffer.from(JSON.stringify({
      username: user.username,
      display_name: user.display_name || user.username,
      role: user.role || 'ADMIN',
      exp: Date.now() + 8 * 60 * 60 * 1000  // หมดอายุใน 8 ชั่วโมง
    })).toString('base64url');

    return res.json({
      token: `${payload}.${sign(payload)}`,
      role: user.role || 'ADMIN',
      display_name: user.display_name || user.username,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function listAdmins(req, res) {
  try {
    const result = await pool_test.query(
      `SELECT username, display_name, role, created_at, last_login
       FROM register_admin_users
       WHERE is_active = true
       ORDER BY username`
    );
    res.json({ admins: result.rows });
  } catch (err) {
    console.error('[Auth] listAdmins error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function deleteAdmin(req, res) {
  const targetUsername = String(req.params.username || '').trim();
  if (!targetUsername) return res.status(400).json({ error: 'Username is required' });
  if (targetUsername === req.admin.username)
    return res.status(400).json({ error: 'You cannot delete the admin account currently in use' });

  try {
    const result = await pool_test.query(
      `UPDATE register_admin_users SET is_active = 'f' WHERE username = $1 RETURNING username`,
      [targetUsername]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Admin account not found' });
    return res.json({ ok: true, username: result.rows[0].username });
  } catch (err) {
    console.error('[Auth] deleteAdmin error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function requireAdmin(req, res, next) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const [payload, signature] = token.split('.');
  try {
    if (!payload || !signature || !secret ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(payload))))
      throw new Error('Invalid token');
    const user = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!user.username || Number(user.exp) < Date.now()) throw new Error('Expired token');
    req.admin = user;
    return next();
  } catch { return res.status(401).json({ error: 'Admin login required' }); }
}

router.post('/login', adminLogin);
router.get('/admins', requireAdmin, listAdmins);
router.delete('/admins/:username', requireAdmin, deleteAdmin);

module.exports = router;
module.exports.default = router;
module.exports.requireAdmin = requireAdmin;
module.exports.listAdmins = listAdmins;
module.exports.deleteAdmin = deleteAdmin;
