const express = require('express');
const { pool_smart, pool_test, pool_ot } = require('../../../../config');
const pool = pool_smart;
const poolTest = pool_test;
const mariaPool = pool_ot;

const { clearAllCache } = require('../../../../../../Utility/apiCache');
const { syncDailyOutputSnapshotFromPostgres } = require('../../../../../../services/productivity/outputSnapshotService');
const { getThaiTimeInfo } = require('../../../../../../services/productivity/snapshotManager');
const { syncProductivityPeriodSummary } = require('../../../../../../services/productivity/periodSummaryService');

const router = express.Router();

function clearAllCacheSafely() {
  try {
    if (typeof clearAllCache === 'function') clearAllCache();
  } catch (_) {}
}


// POST Admin Login via Database (public.register_admin_users)
router.post(['/productivity/admin-login', '/admin-login', '/settings/admin-login'], async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const query = `
      SELECT id, username, password, is_active 
      FROM public.register_admin_users 
      WHERE LOWER(TRIM(username)) = LOWER(TRIM($1)) AND is_active = TRUE
      LIMIT 1
    `;
    const { rows } = await poolTest.query(query, [username.trim()]);

    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = rows[0];
    if (user.password === password.trim()) {
      // Update last_login timestamp in background
      poolTest.query('UPDATE public.register_admin_users SET last_login = NOW() WHERE id = $1', [user.id]).catch(() => {});

      let displayName = user.username;
      let userRole = 'Admin';

      try {
        const extraRes = await poolTest.query(
          'SELECT display_name, role FROM public.register_admin_users WHERE id = $1',
          [user.id]
        );
        if (extraRes.rows.length > 0) {
          if (extraRes.rows[0].display_name) displayName = extraRes.rows[0].display_name;
          if (extraRes.rows[0].role) userRole = extraRes.rows[0].role;
        }
      } catch (e) {
        // Optional columns might not exist yet
      }

      return res.json({ 
        success: true, 
        username: user.username,
        displayName: displayName,
        role: userRole
      });
    }

    return res.status(401).json({ success: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
  } catch (err) {
    console.error('Error during admin login:', err.message);
    return res.status(500).json({ success: false, error: 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล' });
  }
});

// GET all registered admin users
router.get(['/productivity/admin-users', '/admin-users', '/settings/admin-users'], async (req, res) => {
  try {
    const query = `
      SELECT id, username, password, is_active
      FROM public.register_admin_users
      ORDER BY id DESC
    `;
    const { rows } = await poolTest.query(query);

    // Fetch optional columns if they exist
    const enhancedRows = await Promise.all(rows.map(async (u) => {
      let displayName = u.username;
      let userRole = 'Admin';
      let lastLogin = null;

      try {
        const extraRes = await poolTest.query(
          'SELECT display_name, role, last_login FROM public.register_admin_users WHERE id = $1',
          [u.id]
        );
        if (extraRes.rows.length > 0) {
          if (extraRes.rows[0].display_name) displayName = extraRes.rows[0].display_name;
          if (extraRes.rows[0].role) userRole = extraRes.rows[0].role;
          if (extraRes.rows[0].last_login) lastLogin = extraRes.rows[0].last_login;
        }
      } catch (e) {}

      return {
        ...u,
        display_name: displayName,
        role: userRole,
        last_login: lastLogin
      };
    }));

    res.json(enhancedRows);
  } catch (err) {
    console.error('Error fetching admin users:', err.message);
    res.status(500).json({ error: 'ไม่สามารถดึงข้อมูลผู้ใช้งานได้' });
  }
});

// GET employee lookup by employee code (Queries MariaDB tbl_employee_help)
router.get(['/productivity/employee-lookup/:code', '/employee-lookup/:code', '/settings/employee-lookup/:code'], async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ error: 'กรุณาระบุรหัสพนักงาน' });

    const cleanCode = code.trim();
    const numericCode = cleanCode.replace(/^0+/, '');
    const paddedCode = cleanCode.padStart(7, '0');
    const codesToTry = Array.from(new Set([cleanCode, numericCode, paddedCode])).filter(Boolean);

    let employee = null;

    if (mariaPool) {
      try {
        const rowsRaw = await mariaPool.query(
          `SELECT code, name, department 
           FROM tbl_employee_help 
           WHERE TRIM(code) IN (?) OR TRIM(code) LIKE ?
           LIMIT 1`,
          [codesToTry, `%${numericCode}`]
        );
        const rows = Array.isArray(rowsRaw) ? (Array.isArray(rowsRaw[0]) ? rowsRaw[0] : rowsRaw) : [];
        if (rows && rows.length > 0) {
          employee = {
            code: rows[0].code,
            name: rows[0].name,
            department: rows[0].department || '',
            sect: '',
            process: '',
            group_level: '',
            shift: '',
          };
        }
      } catch (e) {
        console.error('MariaDB employee help query error:', e.message);
      }
    }

    if (!employee) {
      return res.status(404).json({ found: false, message: `ไม่พบรหัสพนักงาน ${cleanCode} ในฐานข้อมูลพนักงาน (tbl_employee_help)` });
    }

    res.json({ found: true, employee });
  } catch (err) {
    console.error('Error looking up employee:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการค้นหาพนักงาน' });
  }
});

// POST add new admin user
router.post(['/productivity/admin-users', '/admin-users', '/settings/admin-users'], async (req, res) => {
  try {
    const { username, password, role, display_name } = req.body;
    const empCode = (username || '').trim();
    const pass = (password || '').trim();

    if (!empCode || !pass) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสพนักงานและรหัสผ่าน' });
    }

    // 1. Fetch employee display name from MariaDB if missing
    let empName = (display_name || '').trim();
    let defaultRole = (role || '').trim() || 'Admin';

    if (!empName && mariaPool) {
      try {
        const mRowsRaw = await mariaPool.query(
          `SELECT name FROM tbl_employee_help WHERE TRIM(code) = ? OR TRIM(code) LIKE ? LIMIT 1`,
          [empCode, `%${empCode.replace(/^0+/, '')}`]
        );
        const mRows = Array.isArray(mRowsRaw) ? (Array.isArray(mRowsRaw[0]) ? mRowsRaw[0] : mRowsRaw) : [];
        if (mRows && mRows.length > 0) {
          empName = mRows[0].name;
        }
      } catch (e) {}
    }

    // 2. Check if username already registered
    const dupCheck = await poolTest.query(
      `SELECT id FROM public.register_admin_users WHERE LOWER(TRIM(username)) = LOWER(TRIM($1))`,
      [empCode]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ error: `รหัสพนักงาน ${empCode} ถูกลงทะเบียนในระบบเรียบร้อยแล้ว` });
    }

    // 3. Insert into register_admin_users
    const insertQuery = `
      INSERT INTO public.register_admin_users (username, password, display_name, role, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING id, username, display_name, role
    `;
    const inserted = await poolTest.query(insertQuery, [empCode, pass, empName || empCode, defaultRole]);

    res.json({ success: true, user: inserted.rows[0] });
  } catch (err) {
    console.error('Error adding admin user:', err.message);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกผู้ใช้' });
  }
});

// PUT update admin user details (Role, Password, Display Name)
router.put(['/productivity/admin-users/:id', '/admin-users/:id', '/settings/admin-users/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const { password, role, display_name } = req.body;

    let updateQuery = `
      UPDATE public.register_admin_users
      SET role = $1, display_name = COALESCE(NULLIF($2, ''), display_name)
    `;
    const queryParams = [role || 'Admin', (display_name || '').trim()];

    if (password && password.trim()) {
      updateQuery += `, password = $3 WHERE id = $4 RETURNING id, username, display_name, role`;
      queryParams.push(password.trim(), id);
    } else {
      updateQuery += ` WHERE id = $3 RETURNING id, username, display_name, role`;
      queryParams.push(id);
    }

    const { rows } = await poolTest.query(updateQuery, queryParams);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบผู้ใช้งานนี้' });
    }

    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('Error updating admin user details:', err.message);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตข้อมูลผู้ใช้ได้' });
  }
});

// PUT toggle active/inactive status
router.put(['/productivity/admin-users/:id/status', '/admin-users/:id/status', '/settings/admin-users/:id/status'], async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    await poolTest.query(
      `UPDATE public.register_admin_users SET is_active = $1 WHERE id = $2`,
      [is_active, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating status:', err.message);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะได้' });
  }
});

// DELETE admin user
router.delete(['/productivity/admin-users/:id', '/admin-users/:id', '/settings/admin-users/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    await poolTest.query(`DELETE FROM public.register_admin_users WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting user:', err.message);
    res.status(500).json({ error: 'ไม่สามารถลบผู้ใช้งานได้' });
  }
});

// Helper for audit logs
async function insertAuditLog(recordId, factory, actionType, oldData, newData) {
  try {
    await poolTest.query(
      `INSERT INTO public.line_output_audit_log (record_id, factory, action_type, old_data, new_data)
       VALUES ($1, $2, $3, $4, $5)`,
      [recordId, factory, actionType, oldData ? JSON.stringify(oldData) : null, newData ? JSON.stringify(newData) : null]
    );
  } catch (err) {
    console.error('Failed to insert audit log:', err.message);
  }
}

// GET distinct processes and mc_lines for modal searchable dropdowns
router.get(['/productivity/settings/output-options', '/settings/output-options', '/output-options'], async (req, res) => {
  try {
    const processSet = new Set();
    const mcLineSet = new Set();
    const smtMcSet = new Set();
    const fpcMcSet = new Set();

    // 1. Query FPC Process & Machine Output Detail
    try {
      const fpcRes = await pool.query(`
        SELECT DISTINCT UPPER(TRIM(proc_disp)) AS proc, UPPER(TRIM(mc_line)) AS mc
        FROM smart.smart_fpc_process_output_detail 
        WHERE (proc_disp IS NOT NULL AND TRIM(proc_disp) != '')
           OR (mc_line IS NOT NULL AND TRIM(mc_line) != '')
      `);
      fpcRes.rows.forEach(r => {
        if (r.proc) { processSet.add(r.proc); }
        if (r.mc) { mcLineSet.add(r.mc); fpcMcSet.add(r.mc); }
      });
    } catch (e) {
      console.error('Error querying smart_fpc_process_output_detail for options:', e.message);
    }

    // 2. Query Output Daily Snapshot
    try {
      const snapRes = await poolTest.query(`
        SELECT DISTINCT UPPER(TRIM(process_name)) AS proc, UPPER(TRIM(mc_line)) AS mc, UPPER(TRIM(factory)) AS fac
        FROM public.output_daily_snapshot
        WHERE mc_line IS NOT NULL AND TRIM(mc_line) != ''
      `);
      snapRes.rows.forEach(r => {
        if (r.proc) processSet.add(r.proc);
        if (r.mc) {
          mcLineSet.add(r.mc);
          if (r.fac === 'SMT') smtMcSet.add(r.mc);
          if (r.fac === 'FPC') fpcMcSet.add(r.mc);
        }
      });
    } catch (e) {
      console.error('Error querying output_daily_snapshot for options:', e.message);
    }

    // 3. Query existing line_output_mapping
    try {
      const existingRes = await poolTest.query(`
        SELECT DISTINCT UPPER(TRIM(process_name)) AS proc, UPPER(TRIM(mc_line)) AS mc, UPPER(TRIM(factory)) AS fac
        FROM public.line_output_mapping
      `);
      existingRes.rows.forEach(r => {
        if (r.proc) processSet.add(r.proc);
        if (r.mc) {
          mcLineSet.add(r.mc);
          if (r.fac === 'SMT') smtMcSet.add(r.mc);
          if (r.fac === 'FPC') fpcMcSet.add(r.mc);
        }
      });
    } catch (e) {
      console.error('Error querying line_output_mapping for options:', e.message);
    }

    // 4. Query SMT database tables if accessible
    try {
      const smtRowsRaw = await mariaPool.query(`
        SELECT DISTINCT UPPER(TRIM(line)) AS mc FROM tbl_smt_actual_output WHERE line IS NOT NULL AND TRIM(line) != ''
      `);
      const smtRows = Array.isArray(smtRowsRaw) ? (Array.isArray(smtRowsRaw[0]) ? smtRowsRaw[0] : smtRowsRaw) : [];
      if (Array.isArray(smtRows)) {
        smtRows.forEach(r => {
          if (r.mc) { mcLineSet.add(r.mc); smtMcSet.add(r.mc); }
        });
      }
    } catch (e) {}

    const processes = Array.from(processSet).sort();
    const mcLines = Array.from(mcLineSet).sort();
    const smtMcLines = Array.from(smtMcSet).sort();
    const fpcMcLines = Array.from(fpcMcSet).sort();

    res.json({ processes, mcLines, smtMcLines, fpcMcLines });
  } catch (err) {
    console.error('Error fetching output options:', err.message);
    res.status(500).json({ error: 'Cannot fetch output options' });
  }
});

const INVALID_GROUP_NAME_REGEX = /[/\\@#$%\^&*()+=\[\]{}<>?!~`"';:|]/;

function isValidGroupName(name) {
  if (!name || typeof name !== 'string') return false;
  return !INVALID_GROUP_NAME_REGEX.test(name);
}

// POST sync/replace all mc_lines for a group_name + process_name + factory
router.post(['/productivity/settings/line-groups/sync-machines', '/settings/line-groups/sync-machines', '/line-groups/sync-machines'], async (req, res) => {
  try {
    const { factory, group_name, process_name, mc_lines, prd_prefix } = req.body;
    if (!factory || !group_name || !process_name) {
      return res.status(400).json({ error: 'factory, group_name, and process_name are required' });
    }
    const gName = String(group_name).trim().toUpperCase();
    const pName = String(process_name).trim().toUpperCase();

    if (!isValidGroupName(gName)) {
      return res.status(400).json({ error: 'Group Name ห้ามมีอักขระพิเศษ เช่น /, \\, @, #, (, ) อนุญาตเฉพาะตัวอักษร ตัวเลข ช่องว่าง ขีดกลาง (-) และขีดล่าง (_) เท่านั้น' });
    }

    const rawMcs = Array.isArray(mc_lines) ? mc_lines : [];
    const targetMachines = [...new Set(rawMcs.map(m => String(m || '').trim().toUpperCase()).filter(Boolean))];

    const client = await poolTest.connect();
    try {
      // 1. Check if this line group was previously soft-deleted, and reactivate it
      await poolTest.query(`
        UPDATE public.line_output_mapping
        SET is_active = true, updated_at = CURRENT_TIMESTAMP
        WHERE line_group = $1 AND is_active = false
      `, [line_group]);

      await client.query('BEGIN');

      // 1. Get existing records for this factory + group_name + process_name
      const { rows: existingRows } = await client.query(`
        SELECT id, mc_line, prd_prefix, is_active
        FROM public.line_output_mapping
        WHERE factory = $1 AND group_name = $2 AND process_name = $3
      `, [factory, gName, pName]);

      const existingMcMap = new Map();
      existingRows.forEach(r => {
        const mc = (r.mc_line || '').trim().toUpperCase();
        existingMcMap.set(mc, r);
      });

      if (targetMachines.length === 0) {
        // Delete all existing non-null
        if (existingRows.length > 0) {
          const idsToDelete = existingRows.map(r => r.id);
          await client.query(`DELETE FROM public.line_output_mapping WHERE id = ANY($1::int[])`, [idsToDelete]);
        }
        // Insert single NULL mc_line
        await client.query(`
          INSERT INTO public.line_output_mapping (factory, group_name, process_name, mc_line, prd_prefix, is_active)
          VALUES ($1, $2, $3, NULL, $4, TRUE)
        `, [factory, gName, pName, prd_prefix || null]);
      } else {
        // Find machines to delete
        const targetSet = new Set(targetMachines);
        const idsToDelete = [];
        existingRows.forEach(r => {
          const mc = (r.mc_line || '').trim().toUpperCase();
          if (!targetSet.has(mc) || !mc) {
            idsToDelete.push(r.id);
          }
        });

        if (idsToDelete.length > 0) {
          await client.query(`DELETE FROM public.line_output_mapping WHERE id = ANY($1::int[])`, [idsToDelete]);
        }

        // Find machines to insert
        const machinesToInsert = targetMachines.filter(mc => !existingMcMap.has(mc));
        if (machinesToInsert.length > 0) {
          await client.query(`
            INSERT INTO public.line_output_mapping (factory, group_name, process_name, mc_line, prd_prefix, is_active)
            SELECT $1::varchar, $2::varchar, $3::varchar, m.mc_line, $5::text, TRUE
            FROM unnest($4::text[]) AS m(mc_line)
          `, [factory, gName, pName, machinesToInsert, prd_prefix || null]);
        }
      }

      await client.query('COMMIT');
      clearAllCacheSafely();
      res.json({ success: true, count: targetMachines.length, group_name: gName, process_name: pName });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error syncing group machines:', err.message);
    res.status(500).json({ error: err.message || 'Cannot sync group machines' });
  }
});

// GET all line groups (both active and inactive)
router.get(['/productivity/settings/line-groups', '/settings/line-groups', '/line-groups'], async (req, res) => {
  try {
    const query = `
      SELECT id, group_name, process_name, mc_line, prd_prefix, exclude_prefixes, COALESCE(factory, 'SMT') as factory, is_active 
      FROM public.line_output_mapping
      ORDER BY factory DESC, group_name ASC, id ASC
    `;
    const { rows } = await poolTest.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching line groups:', err.message);
    res.status(500).json({ error: 'Cannot fetch line groups' });
  }
});

// GET audit history logs
router.get(['/productivity/settings/line-groups/history', '/settings/line-groups/history', '/line-groups/history'], async (req, res) => {
  try {
    const query = `
      SELECT * FROM public.line_output_audit_log
      ORDER BY created_at DESC
      LIMIT 100
    `;
    const { rows } = await poolTest.query(query);
    res.json(rows);
  } catch (err) {
    console.error('Error fetching audit logs:', err.message);
    res.status(500).json({ error: 'Cannot fetch audit logs' });
  }
});

// POST new line group (supports batch group creation)
router.post(['/productivity/settings/line-groups', '/settings/line-groups', '/line-groups'], async (req, res) => {
  try {
    const { factory, group_name, group_names, process_name, process_names, mc_line, mc_lines, prd_prefix, prd_prefixes, exclude_prefixes } = req.body;
    
    const rawGroups = Array.isArray(group_names) ? group_names : (group_name ? [group_name] : []);
    const groups = [...new Set(rawGroups.flatMap(g => String(g || '').split(/[\n,]+/)).map(v => v.trim().toUpperCase()).filter(Boolean))];

    const processValues = Array.isArray(process_names) ? process_names : [process_name];
    const machineValues = Array.isArray(mc_lines) ? mc_lines : [mc_line || null];
    const processes = [...new Set(processValues.map(value => String(value || '').trim().toUpperCase()).filter(Boolean))];
    const machines = [...new Set(machineValues.map(value => {
      const normalized = String(value || '').trim().toUpperCase();
      return normalized || null;
    }))];

    const rawPrefixes = Array.isArray(prd_prefixes) && prd_prefixes.length > 0
      ? prd_prefixes
      : (prd_prefix ? String(prd_prefix).split(/[\n,]+/).map(p => p.trim().toUpperCase()).filter(Boolean) : []);
    const prefixes = rawPrefixes.length > 0 ? [...new Set(rawPrefixes)] : [null];

    const cleanExclude = Array.isArray(exclude_prefixes) 
      ? exclude_prefixes.map(p => String(p || '').trim().toUpperCase()).filter(Boolean).join(', ')
      : (exclude_prefixes ? String(exclude_prefixes).trim().toUpperCase() : null);

    if (groups.length === 0 || processes.length === 0) {
      return res.status(400).json({ error: 'At least one group_name and process_name are required' });
    }
    
    const invalidGroup = groups.find(g => !isValidGroupName(g));
    if (invalidGroup) {
      return res.status(400).json({ error: `ชื่อ Group Name "${invalidGroup}" มีอักขระพิเศษที่ไม่อนุญาต เช่น /, \\, @, #, (, ) อนุญาตเฉพาะตัวอักษร ตัวเลข ช่องว่าง ขีดกลาง (-) และขีดล่าง (_) เท่านั้น` });
    }

    if (groups.length * processes.length * machines.length * prefixes.length > 5000) {
      return res.status(400).json({ error: 'Too many combinations at once' });
    }

    const query = `
      INSERT INTO public.line_output_mapping (factory, group_name, process_name, mc_line, prd_prefix, exclude_prefixes, is_active)
      SELECT $1::varchar, $2::varchar, p.process_name, m.mc_line, $5::text, $6::text, TRUE
      FROM unnest($3::text[]) AS p(process_name)
      CROSS JOIN unnest($4::text[]) AS m(mc_line)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.line_output_mapping existing
        WHERE existing.factory = $1::varchar
          AND existing.group_name = $2::varchar
          AND existing.process_name = p.process_name
          AND existing.mc_line IS NOT DISTINCT FROM m.mc_line
          AND existing.prd_prefix IS NOT DISTINCT FROM $5::text
      )
      RETURNING *
    `;

    const allInsertedRows = [];
    for (const gName of groups) {
      for (const prd of prefixes) {
        const values = [factory, gName, processes, machines, prd, cleanExclude || null];
        const { rows } = await poolTest.query(query, values);
        for (const row of rows) {
          await insertAuditLog(row.id, factory, 'INSERT', null, { ...row, factory });
          allInsertedRows.push({ ...row, factory });
        }
      }
    }

    clearAllCacheSafely();
    syncDailyOutputSnapshotFromPostgres(35).catch(err => {
      console.error('[AutoSync] Background output snapshot sync error after line insert:', err.message);
    });

    res.json({
      records: allInsertedRows,
      insertedCount: allInsertedRows.length,
      totalRequested: groups.length * processes.length * machines.length * prefixes.length
    });
  } catch (err) {
    console.error('Error adding line group:', err.message);
    const safeError = err.code === '23505'
      ? 'This line output mapping already exists'
      : err.code === '22001'
        ? 'One of the values is longer than the database field allows'
        : err.code === '42P01'
          ? 'The selected factory output table was not found'
          : (err.message || 'Cannot add line group');
    res.status(500).json({ error: safeError });
  }
});

// PUT update line group
router.put(['/productivity/settings/line-groups/:id/:factory', '/settings/line-groups/:id/:factory', '/line-groups/:id/:factory'], async (req, res) => {
  try {
    const { id, factory: paramFactory } = req.params;
    const { factory: bodyFactory, group_name, process_name, mc_line, mc_lines, prd_prefix, prd_prefixes, exclude_prefixes, item_ids, is_active } = req.body;
    
    const targetFactory = String(bodyFactory || paramFactory || 'SMT').trim().toUpperCase();
    const gName = String(group_name || '').trim().toUpperCase();
    const pName = String(process_name || '').trim().toUpperCase();

    if (!gName || !pName) {
      return res.status(400).json({ error: 'group_name and process_name are required' });
    }

    if (!isValidGroupName(gName)) {
      return res.status(400).json({ error: 'Group Name ห้ามมีอักขระพิเศษ เช่น /, \\, @, #, (, ) อนุญาตเฉพาะตัวอักษร ตัวเลข ช่องว่าง ขีดกลาง (-) และขีดล่าง (_) เท่านั้น' });
    }

    const ids = Array.isArray(item_ids) && item_ids.length > 0 ? item_ids : [id];

    // Get old records for audit log
    const { rows: oldRows } = await poolTest.query(`SELECT * FROM public.line_output_mapping WHERE id = ANY($1::int[])`, [ids]);
    
    // Parse prefixes & machines
    const rawPrefixes = Array.isArray(prd_prefixes) && prd_prefixes.length > 0 
      ? prd_prefixes 
      : (prd_prefix ? String(prd_prefix).split(/[\n,]+/).map(p => p.trim().toUpperCase()).filter(Boolean) : []);
    const targetPrefixes = rawPrefixes.length > 0 ? [...new Set(rawPrefixes)] : [null];

    const rawMcs = Array.isArray(mc_lines) && mc_lines.length > 0
      ? mc_lines
      : (mc_line ? String(mc_line).split(/[\n,]+/).map(m => m.trim().toUpperCase()).filter(Boolean) : []);
    const targetMachines = rawMcs.length > 0 ? [...new Set(rawMcs)] : [null];

    const cleanExclude = Array.isArray(exclude_prefixes) 
      ? exclude_prefixes.map(p => String(p || '').trim().toUpperCase()).filter(Boolean).join(', ')
      : (exclude_prefixes ? String(exclude_prefixes).trim().toUpperCase() : (oldRows[0]?.exclude_prefixes || null));

    const client = await poolTest.connect();
    try {
      await client.query('BEGIN');

      // Delete existing records in this group
      await client.query(`DELETE FROM public.line_output_mapping WHERE id = ANY($1::int[])`, [ids]);

      // Insert clean separate rows for each machine and each prefix
      const insertedRows = [];
      for (const mc of targetMachines) {
        for (const prd of targetPrefixes) {
          const insertQuery = `
            INSERT INTO public.line_output_mapping (factory, group_name, process_name, mc_line, prd_prefix, exclude_prefixes, is_active, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            RETURNING *
          `;
          const { rows } = await client.query(insertQuery, [targetFactory, gName, pName, mc, prd, cleanExclude || null, is_active !== undefined ? is_active : true]);
          if (rows[0]) insertedRows.push(rows[0]);
        }
      }

      await client.query('COMMIT');

      if (oldRows.length > 0 && insertedRows.length > 0) {
        await insertAuditLog(insertedRows[0].id, targetFactory, 'UPDATE', oldRows[0], insertedRows[0]);
      }
      clearAllCacheSafely();
      syncDailyOutputSnapshotFromPostgres(35).catch(err => {
        console.error('[AutoSync] Background output snapshot sync error after line replace:', err.message);
      });

      res.json(insertedRows[0] || { success: true });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error updating line group:', err.message);
    res.status(500).json({ error: err.message || 'Cannot update line group' });
  }
});

// POST trigger on-demand output snapshot re-sync for closed days
router.post(['/productivity/settings/sync-output-snapshot', '/settings/sync-output-snapshot', '/sync-output-snapshot'], async (req, res) => {
  try {
    const { lookbackDays, startDate, endDate } = req.body || {};
    const days = Number(lookbackDays) || 30;
    const result = await syncDailyOutputSnapshotFromPostgres(days, startDate, endDate);
    clearAllCacheSafely();
    res.json({
      success: result.success,
      count: result.count,
      startDate: result.startDate,
      endDate: result.endDate,
      message: result.success ? `Successfully synced ${result.count} records` : (result.error || result.message)
    });
  } catch (err) {
    console.error('Error in manual snapshot sync:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});


// GET check output preview for a line group or specific processes/machines
router.get(['/productivity/settings/check-group-output', '/settings/check-group-output', '/check-group-output'], async (req, res) => {
  try {
    const {
      group_name,
      factory = 'ALL',
      startDate: queryStartDate,
      endDate: queryEndDate,
      process_names,
      mc_lines,
      prd_prefixes,
      exclude_prefixes
    } = req.query;

    const { yesterdayStr } = getThaiTimeInfo();
    const endDate = queryEndDate || yesterdayStr;
    let startDate = queryStartDate;
    if (!startDate) {
      const endD = new Date(endDate);
      const startD = new Date(endD.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate = startD.toISOString().slice(0, 10);
    }

    let rows = [];
    let source = 'snapshot';

    // 1. Query public.output_daily_snapshot by group_name
    if (group_name) {
      let snapSql = `
        SELECT 
          output_date::text as output_date,
          factory,
          line_group,
          process_name,
          mc_line,
          prd_name,
          actual_lot_qty,
          actual_sht_qty,
          actual_piece_qty,
          fac_unit_code
        FROM public.output_daily_snapshot
        WHERE line_group = $1
          AND output_date >= $2::date
          AND output_date <= $3::date
      `;
      const snapParams = [group_name, startDate, endDate];
      if (factory && factory !== 'ALL') {
        snapParams.push(factory);
        snapSql += ` AND (factory = $${snapParams.length} OR factory IS NULL)`;
      }
      snapSql += ` ORDER BY output_date DESC, actual_piece_qty DESC`;

      const snapRes = await poolTest.query(snapSql, snapParams);
      rows = snapRes.rows;
    }

    // 2. If no snapshot rows found or if testing unmapped processes directly
    if (rows.length === 0) {
      let targetProcesses = [];
      if (process_names) {
        targetProcesses = String(process_names).split(/[\n,]+/).map(p => p.trim().toUpperCase()).filter(Boolean);
      } else if (group_name) {
        const mapRes = await poolTest.query(
          `SELECT DISTINCT process_name FROM public.line_output_mapping WHERE group_name = $1 AND is_active = TRUE`,
          [group_name]
        );
        targetProcesses = mapRes.rows.map(r => (r.process_name || '').trim().toUpperCase()).filter(Boolean);
      }

      if (targetProcesses.length > 0) {
        source = 'raw_detail';
        const rawSql = `
          SELECT 
            TO_CHAR(output_date, 'YYYY-MM-DD') AS output_date,
            TRIM(UPPER(proc_disp)) AS process_name,
            TRIM(UPPER(mc_line)) AS mc_line,
            prd_name,
            SUM(COALESCE(lot_qty, 0)) AS actual_lot_qty,
            SUM(COALESCE(sht_qty, 0)) AS actual_sht_qty,
            SUM(COALESCE(pcs_qty, 0)) AS actual_piece_qty
          FROM smart.smart_fpc_process_output_detail
          WHERE output_date >= $1::date
            AND output_date < ($2::date + INTERVAL '1 day')
            AND TRIM(UPPER(proc_disp)) = ANY($3::text[])
          GROUP BY output_date, proc_disp, mc_line, prd_name
          ORDER BY output_date DESC, actual_piece_qty DESC
          LIMIT 1000
        `;
        const rawRes = await pool.query(rawSql, [startDate, endDate, targetProcesses]);
        rows = rawRes.rows.map(r => ({
          ...r,
          line_group: group_name || 'TEST',
          factory: factory !== 'ALL' ? factory : 'FPC'
        }));
      }
    }

    // Filter optional machine / prefix in memory if specified
    const targetMcs = mc_lines ? String(mc_lines).split(/[\n,]+/).map(m => m.trim().toUpperCase()).filter(Boolean) : [];
    const targetPrefixes = prd_prefixes ? String(prd_prefixes).split(/[\n,]+/).map(p => p.trim().toUpperCase()).filter(Boolean) : [];
    const targetExcludes = exclude_prefixes ? String(exclude_prefixes).split(/[\n,]+/).map(e => e.trim().toUpperCase()).filter(Boolean) : [];

    if (targetMcs.length > 0 || targetPrefixes.length > 0 || targetExcludes.length > 0) {
      rows = rows.filter(r => {
        const mc = (r.mc_line || '').trim().toUpperCase();
        const prd = (r.prd_name || '').trim().toUpperCase();
        if (targetMcs.length > 0 && !targetMcs.includes(mc)) return false;
        if (targetPrefixes.length > 0 && !targetPrefixes.some(p => prd.startsWith(p))) return false;
        if (targetExcludes.length > 0 && targetExcludes.some(e => prd.startsWith(e))) return false;
        return true;
      });
    }

    // Compute aggregations
    let totalPieces = 0;
    let totalSheets = 0;
    let totalLots = 0;
    const dailyMap = new Map();
    const processMap = new Map();
    const machineMap = new Map();

    rows.forEach(r => {
      const pcs = Number(r.actual_piece_qty || 0);
      const sht = Number(r.actual_sht_qty || 0);
      const lot = Number(r.actual_lot_qty || 0);

      totalPieces += pcs;
      totalSheets += sht;
      totalLots += lot;

      // daily
      const d = r.output_date;
      if (!dailyMap.has(d)) {
        dailyMap.set(d, { output_date: d, pieces: 0, sheets: 0, lots: 0, count: 0 });
      }
      const dObj = dailyMap.get(d);
      dObj.pieces += pcs;
      dObj.sheets += sht;
      dObj.lots += lot;
      dObj.count++;

      // process
      const p = r.process_name || 'UNKNOWN';
      if (!processMap.has(p)) {
        processMap.set(p, { process_name: p, pieces: 0, sheets: 0, lots: 0, count: 0 });
      }
      const pObj = processMap.get(p);
      pObj.pieces += pcs;
      pObj.sheets += sht;
      pObj.lots += lot;
      pObj.count++;

      // machine
      const m = r.mc_line || '-';
      if (!machineMap.has(m)) {
        machineMap.set(m, { mc_line: m, pieces: 0, sheets: 0, lots: 0, count: 0 });
      }
      const mObj = machineMap.get(m);
      mObj.pieces += pcs;
      mObj.sheets += sht;
      mObj.lots += lot;
      mObj.count++;
    });

    const daily = Array.from(dailyMap.values()).sort((a, b) => b.output_date.localeCompare(a.output_date));
    const byProcess = Array.from(processMap.values()).sort((a, b) => b.pieces - a.pieces);
    const byMachine = Array.from(machineMap.values()).sort((a, b) => b.pieces - a.pieces);

    res.json({
      success: true,
      group_name: group_name || null,
      factory,
      startDate,
      endDate,
      source,
      summary: {
        total_pieces: totalPieces,
        total_sheets: totalSheets,
        total_lots: totalLots,
        active_days_count: dailyMap.size,
        records_count: rows.length
      },
      daily,
      by_process: byProcess,
      by_machine: byMachine,
      recent_records: rows.slice(0, 100)
    });
  } catch (err) {
    console.error('Error checking group output:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE (Soft Delete) line group
router.delete(['/productivity/settings/line-groups/:id/:factory', '/settings/line-groups/:id/:factory', '/line-groups/:id/:factory'], async (req, res) => {
  try {
    const { id, factory } = req.params;
    const cleanSnapshot = req.query.clean_snapshot === 'true' || req.query.clean_snapshot === '1';
    
    const { rows: oldRows } = await poolTest.query(`SELECT * FROM public.line_output_mapping WHERE id = $1`, [id]);
    if (oldRows.length === 0) return res.status(404).json({ error: 'Not found' });
    const oldRecord = { ...oldRows[0], factory };
    const groupName = oldRows[0].group_name;

    const query = `
      UPDATE public.line_output_mapping
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const { rows } = await poolTest.query(query, [id]);
    const newRecord = { ...rows[0], factory };

    let deletedSnapshotRows = 0;
    let deletedPeriodRows = 0;
    if (groupName) {
      // Check if any other active mappings remain for this group_name
      const { rows: remainRows } = await poolTest.query(
        `SELECT COUNT(*) as count FROM public.line_output_mapping WHERE group_name = $1 AND is_active = TRUE AND id != $2`,
        [groupName, id]
      );
      const remainingCount = Number(remainRows[0]?.count || 0);

      if (cleanSnapshot || remainingCount === 0) {
        const snapDel = await poolTest.query(
          `DELETE FROM public.output_daily_snapshot WHERE line_group = $1`,
          [groupName]
        );
        deletedSnapshotRows = snapDel.rowCount || 0;

        const ppsDel = await poolTest.query(
          `DELETE FROM public.productivity_period_summary WHERE line_group = $1`,
          [groupName]
        );
        deletedPeriodRows = ppsDel.rowCount || 0;
        console.log(`[DeleteLineGroup] Cleaned ${deletedSnapshotRows} snapshot rows and ${deletedPeriodRows} period rows for: ${groupName}`);
      }
    }
    
    await insertAuditLog(id, factory, 'DELETE', oldRecord, newRecord);
    clearAllCacheSafely();
    syncDailyOutputSnapshotFromPostgres(35).catch(err => {
      console.error('[AutoSync] Background output snapshot sync error after line delete:', err.message);
    });
    
    res.json({
      success: true,
      message: 'Deleted successfully',
      data: newRecord,
      deletedSnapshotRows,
      deletedPeriodRows
    });
  } catch (err) {
    console.error('Error soft deleting line group:', err.message);
    res.status(500).json({ error: 'Cannot delete line group' });
  }
});

// DELETE entire group by group_name and clean its snapshot from matrix
router.delete([
  '/productivity/settings/line-groups-by-name/:group_name',
  '/settings/line-groups-by-name/:group_name',
  '/line-groups-by-name/:group_name'
], async (req, res) => {
  try {
    const { group_name } = req.params;
    const cleanSnapshot = req.query.clean_snapshot !== 'false'; // default true
    
    if (!group_name) return res.status(400).json({ error: 'Group name is required' });

    // 1. Deactivate in line_output_mapping
    const mapRes = await poolTest.query(
      `UPDATE public.line_output_mapping SET is_active = FALSE, updated_at = NOW() WHERE group_name = $1 RETURNING id, factory`,
      [group_name]
    );

    // 2. Clean snapshot if requested
    let deletedSnapshotRows = 0;
    let deletedPeriodRows = 0;
    if (cleanSnapshot) {
      const snapRes = await poolTest.query(
        `DELETE FROM public.output_daily_snapshot WHERE line_group = $1`,
        [group_name]
      );
      deletedSnapshotRows = snapRes.rowCount || 0;

      const ppsRes = await poolTest.query(
        `DELETE FROM public.productivity_period_summary WHERE line_group = $1`,
        [group_name]
      );
      deletedPeriodRows = ppsRes.rowCount || 0;
      console.log(`[DeleteGroupByName] Deleted ${deletedSnapshotRows} snapshot rows and ${deletedPeriodRows} period rows for: ${group_name}`);
    }

    clearAllCacheSafely();
    syncDailyOutputSnapshotFromPostgres(35).catch(err => {
      console.error('[AutoSync] Background output snapshot sync error after group delete:', err.message);
    });

    res.json({
      success: true,
      message: `Deleted group ${group_name} successfully`,
      deletedMappings: mapRes.rowCount || 0,
      deletedSnapshotRows,
      deletedPeriodRows
    });
  } catch (err) {
    console.error('Error deleting group by name:', err.message);
    res.status(500).json({ error: 'Cannot delete group by name' });
  }
});

// ==========================================
// COST CENTER MANAGEMENT API ENDPOINTS
// ==========================================

// GET all cost centers (unified from public.cost_centers, unmapped HR cost centers, and available line groups)
router.get(['/productivity/settings/cost-centers', '/settings/cost-centers', '/cost-centers'], async (req, res) => {
  try {
    const ccRes = await poolTest.query(
      `SELECT id, cost_center_code, cost_center_name, COALESCE(type, 'DIRECT') as type, process, line, ship, line_out 
       FROM public.cost_centers 
       ORDER BY CASE WHEN TRIM(cost_center_code) = '' THEN 1 ELSE 0 END ASC, cost_center_code ASC`
    );

    const directRows = ccRes.rows
      .filter(r => (r.type || '').toUpperCase() === 'DIRECT')
      .map(r => ({ ...r, source_table: 'cost_centers' }));
    const indirectRows = ccRes.rows
      .filter(r => (r.type || '').toUpperCase() === 'INDIRECT')
      .map(r => ({ ...r, source_table: 'cost_centers' }));
    const indirectProdRows = ccRes.rows
      .filter(r => (r.type || '').toUpperCase() === 'INDIRECT PRODUCTION')
      .map(r => ({ ...r, source_table: 'cost_centers' }));

    const mappedSet = new Set();
    ccRes.rows.forEach(r => {
      if (r.cost_center_code) {
        const c = r.cost_center_code.trim().toUpperCase();
        mappedSet.add(c);
        mappedSet.add(c.split('/')[0].trim());
      }
    });

    let unmappedRows = [];
    try {
      const mariaRowsRaw = await mariaPool.query(
        `SELECT DISTINCT TRIM(cost_center) as cost_center, TRIM(line_in) as hr_line, TRIM(line_out) as hr_dept
         FROM tbl_help
         WHERE cost_center IS NOT NULL AND TRIM(cost_center) != ''`
      );

      const mariaRows = Array.isArray(mariaRowsRaw) ? (Array.isArray(mariaRowsRaw[0]) ? mariaRowsRaw[0] : mariaRowsRaw) : [];
      const unmappedMap = new Map();
      mariaRows.forEach(row => {
        const rawCc = (row.cost_center || '').trim().toUpperCase();
        const baseCode = rawCc.split('/')[0].trim();
        const hrLine = (row.hr_line || '').trim().toUpperCase();

        if (
          !baseCode || 
          mappedSet.has(baseCode) || 
          mappedSet.has(rawCc) || 
          hrLine.startsWith('TCO') || 
          hrLine.startsWith('TRAINING') ||
          hrLine.startsWith('EXCESS')
        ) {
          return;
        }

        if (!unmappedMap.has(baseCode)) {
          unmappedMap.set(baseCode, {
            cost_center_code: baseCode,
            cost_center_name: `${rawCc} (${row.hr_dept || row.hr_line || 'HR Unmapped'})`,
            type: 'DIRECT',
            process: 'IND',
            line: row.hr_line || 'IND',
            ship: 'D',
            line_out: '',
            is_unmapped: true
          });
        }
      });
      unmappedRows = Array.from(unmappedMap.values());
    } catch (mariaErr) {
      console.warn('Could not query MariaDB tbl_help for unmapped CCs:', mariaErr.message);
    }

    // Fetch available line groups from line output mapping
    const mappingRes = await poolTest.query('SELECT DISTINCT group_name FROM public.line_output_mapping WHERE is_active = TRUE');
    const availableLineGroups = mappingRes.rows.map(r => r.group_name).filter(Boolean).sort();

    res.json({
      direct: directRows,
      indirect: indirectRows,
      indirect_production: indirectProdRows,
      all: ccRes.rows.map(r => ({ ...r, source_table: 'cost_centers' })),
      unmapped: unmappedRows,
      availableLineGroups
    });
  } catch (err) {
    console.error('Error fetching cost centers:', err.message);
    res.status(500).json({ error: 'Cannot fetch cost centers' });
  }
});

// Audit log helper for Cost Centers
async function insertCcAuditLog(ccCode, actionType, oldData, newData, performedBy) {
  try {
    await poolTest.query(
      `INSERT INTO public.cost_center_audit_log (cost_center_code, action_type, old_data, new_data, performed_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [ccCode || '', actionType, oldData ? JSON.stringify(oldData) : null, newData ? JSON.stringify(newData) : null, performedBy || 'Admin']
    );
  } catch (err) {
    console.error('Failed to insert CC audit log:', err.message);
  }
}

// GET Cost Center Audit Logs
router.get(['/productivity/settings/cost-center-audit-logs', '/settings/cost-center-audit-logs', '/cost-center-audit-logs'], async (req, res) => {
  try {
    const { rows } = await poolTest.query(
      `SELECT id, cost_center_code, action_type, old_data, new_data, performed_by, created_at
       FROM public.cost_center_audit_log
       ORDER BY id DESC
       LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching cost center audit logs:', err.message);
    res.status(500).json({ error: 'Cannot fetch audit logs' });
  }
});

// POST Create or Upsert Cost Center
router.post(['/productivity/settings/cost-centers', '/settings/cost-centers', '/cost-centers'], async (req, res) => {
  try {
    const { cost_center_code, cost_center_name, type, process, line, ship, line_out, performed_by } = req.body;
    if (!cost_center_code || !cost_center_name) {
      return res.status(400).json({ error: 'Cost center code and name are required' });
    }

    const cleanCode = cost_center_code.trim().toUpperCase();
    const cleanName = cost_center_name.trim();
    const cleanType = (type || 'DIRECT').trim().toUpperCase();

    // Check duplicate or existing to UPSERT smoothly in single cost_centers table
    const existingCheck = await poolTest.query(`SELECT id FROM public.cost_centers WHERE UPPER(TRIM(cost_center_code)) = $1`, [cleanCode]);

    let record;
    if (existingCheck.rows.length > 0) {
      const existingId = existingCheck.rows[0].id;
      const updateRes = await poolTest.query(`
        UPDATE public.cost_centers
        SET cost_center_name = $1, type = $2, process = $3, line = $4, ship = $5, line_out = $6, updated_at = CURRENT_TIMESTAMP
        WHERE id = $7
        RETURNING *
      `, [cleanName, cleanType, (process || 'IND').trim(), (line || 'IND').trim(), (ship || 'D').trim().toUpperCase(), (line_out || '').trim(), existingId]);

      record = { ...updateRes.rows[0], source_table: 'cost_centers' };
      await insertCcAuditLog(cleanCode, 'UPDATE', null, record, performed_by || req.headers['x-user-name']);
    } else {
      const insertRes = await poolTest.query(`
        INSERT INTO public.cost_centers (cost_center_code, cost_center_name, type, process, line, ship, line_out)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [cleanCode, cleanName, cleanType, (process || 'IND').trim(), (line || 'IND').trim(), (ship || 'D').trim().toUpperCase(), (line_out || '').trim()]);
      record = { ...insertRes.rows[0], source_table: 'cost_centers' };
      await insertCcAuditLog(cleanCode, 'CREATE', null, record, performed_by || req.headers['x-user-name']);
    }

    clearAllCacheSafely();
    syncDailyOutputSnapshotFromPostgres(35).catch(err => {
      console.error('[AutoSync] Background output snapshot sync error after cost center create/update:', err.message);
    });

    res.json({
      message: 'Cost Center saved successfully',
      data: record
    });
  } catch (err) {
    console.error('Error creating cost center:', err.message);
    res.status(500).json({ error: 'Cannot create cost center' });
  }
});

// PUT Update Cost Center
router.put(['/productivity/settings/cost-centers/:id', '/settings/cost-centers/:id', '/cost-centers/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const { cost_center_code, cost_center_name, type, process, line, ship, line_out, performed_by } = req.body;

    if (!cost_center_code || !cost_center_name) {
      return res.status(400).json({ error: 'Cost center code and name are required' });
    }

    const cleanCode = cost_center_code.trim().toUpperCase();
    const cleanName = cost_center_name.trim();
    const cleanType = (type || 'DIRECT').trim().toUpperCase();

    // Fetch old record for audit log
    const oldRes = await poolTest.query(`SELECT * FROM public.cost_centers WHERE id = $1`, [id]);
    const oldRecord = oldRes.rows[0] || null;

    const updateQuery = `
      UPDATE public.cost_centers
      SET cost_center_code = $1, cost_center_name = $2, type = $3, process = $4, line = $5, ship = $6, line_out = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `;
    const { rows } = await poolTest.query(updateQuery, [
      cleanCode, cleanName, cleanType, (process || 'IND').trim(), (line || 'IND').trim(), (ship || 'D').trim().toUpperCase(), (line_out || '').trim(), id
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cost Center not found' });
    }

    const newRecord = { ...rows[0], source_table: 'cost_centers' };

    await insertCcAuditLog(cleanCode, 'UPDATE', oldRecord, newRecord, performed_by || req.headers['x-user-name']);

    clearAllCacheSafely();

    res.json({
      message: 'Cost Center updated successfully',
      data: newRecord
    });
  } catch (err) {
    console.error('Error updating cost center:', err.message);
    res.status(500).json({ error: 'Cannot update cost center' });
  }
});

// DELETE Cost Center
router.delete(['/productivity/settings/cost-centers/:id', '/settings/cost-centers/:id', '/cost-centers/:id'], async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by } = req.query;

    const { rows } = await poolTest.query(`DELETE FROM public.cost_centers WHERE id = $1 RETURNING *`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Cost Center not found' });
    }

    const deletedRecord = rows[0];

    await insertCcAuditLog(deletedRecord.cost_center_code, 'DELETE', deletedRecord, null, performed_by || req.headers['x-user-name']);

    clearAllCacheSafely();

    res.json({ message: 'Cost Center deleted successfully', data: deletedRecord });
  } catch (err) {
    console.error('Error deleting cost center:', err.message);
    res.status(500).json({ error: 'Cannot delete cost center' });
  }
});


// Auto-create public.custom_macro_lines table
(async () => {
  try {
    await poolTest.query(`
      CREATE TABLE IF NOT EXISTS public.custom_macro_lines (
        id SERIAL PRIMARY KEY,
        macro_name VARCHAR(100) NOT NULL UNIQUE,
        sub_lines JSONB NOT NULL,
        output_source_line TEXT,
        position_before VARCHAR(100),
        show_plan_row BOOLEAN DEFAULT TRUE,
        show_target_row BOOLEAN DEFAULT TRUE,
        show_ot_rows BOOLEAN DEFAULT FALSE,
        show_leave_rows BOOLEAN DEFAULT FALSE,
        units JSONB DEFAULT '["piece"]',
        factory VARCHAR(50) DEFAULT 'SMT',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE public.custom_macro_lines ADD COLUMN IF NOT EXISTS show_plan_row BOOLEAN DEFAULT TRUE;
      ALTER TABLE public.custom_macro_lines ADD COLUMN IF NOT EXISTS show_target_row BOOLEAN DEFAULT TRUE;
      ALTER TABLE public.custom_macro_lines ADD COLUMN IF NOT EXISTS units JSONB DEFAULT '["piece"]';
      ALTER TABLE public.custom_macro_lines ADD COLUMN IF NOT EXISTS factory VARCHAR(50) DEFAULT 'SMT';
    `);

    try {
      await poolTest.query(`ALTER TABLE public.line_output_mapping ADD COLUMN IF NOT EXISTS exclude_prefixes TEXT;`);
      await poolTest.query(`ALTER TABLE public.line_output_mapping ALTER COLUMN prd_prefix TYPE TEXT;`);
    } catch (_) {}

    // Seed default Automotive macro line if table is empty
    const { rows } = await poolTest.query(`SELECT COUNT(*) FROM public.custom_macro_lines`);
    if (parseInt(rows[0].count, 10) === 0) {
      await poolTest.query(`
        INSERT INTO public.custom_macro_lines 
        (macro_name, sub_lines, output_source_line, position_before, show_plan_row, show_target_row, show_ot_rows, show_leave_rows, units, factory)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, ['Automotive', JSON.stringify(['LINE MOTA_A', 'LINE ASY1_A']), 'LINE ASY1_A', 'LINE MOTA_A', true, true, false, false, JSON.stringify(['piece']), 'SMT']);
    }
  } catch (err) {
    console.warn('custom_macro_lines table init warning:', err.message);
  }
})();

// GET /productivity/settings/macro-lines
router.get(['/productivity/settings/macro-lines', '/settings/macro-lines', '/macro-lines'], async (req, res) => {
  try {
    const { rows } = await poolTest.query(`
      SELECT id, macro_name, sub_lines, output_source_line, position_before, show_plan_row, show_target_row, show_ot_rows, show_leave_rows, units, factory, is_active
      FROM public.custom_macro_lines
      WHERE is_active = TRUE
      ORDER BY id ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching custom macro lines:', err.message);
    res.status(500).json({ error: 'Cannot fetch custom macro lines', details: err.message });
  }
});

// POST /productivity/settings/dynamic-lines & /productivity/settings/macro-lines (Create or Update)
router.post([
  '/productivity/settings/dynamic-lines',
  '/settings/dynamic-lines',
  '/dynamic-lines',
  '/productivity/settings/macro-lines',
  '/settings/macro-lines',
  '/macro-lines'
], async (req, res) => {
  try {
    const {
      macro_name,
      line_name,
      display_name,
      sub_lines,
      cost_center_sources,
      sub_line_sources,
      output_sources,
      output_source_line,
      position_before,
      show_plan_row,
      show_target_row,
      show_ot_rows,
      show_leave_rows,
      units,
      factory
    } = req.body;

    const cleanName = (line_name || display_name || macro_name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ success: false, error: 'line_name is required' });
    }

    const combinedSubLines = Array.from(new Set([
      ...(Array.isArray(sub_lines) ? sub_lines : []),
      ...(Array.isArray(cost_center_sources) ? cost_center_sources : []),
      ...(Array.isArray(sub_line_sources) ? sub_line_sources : [])
    ])).filter(Boolean);

    const outSources = output_sources || output_source_line;
    let formattedOutputSource = null;
    let hasOutSources = false;
    if (Array.isArray(outSources)) {
      const validOuts = outSources.filter(Boolean);
      if (validOuts.length > 0) {
        formattedOutputSource = JSON.stringify(validOuts);
        hasOutSources = true;
      }
    } else if (typeof outSources === 'string' && outSources.trim()) {
      formattedOutputSource = outSources.trim();
      hasOutSources = true;
    }

    if (combinedSubLines.length === 0 && !hasOutSources) {
      return res.status(400).json({ success: false, error: 'At least one source (output or manpower) is required' });
    }

    const formattedUnits = Array.isArray(units) && units.length > 0 ? JSON.stringify(units) : JSON.stringify(['piece']);
    const cleanFactory = (factory || 'SMT').trim().toUpperCase();
    const targetId = req.body.id;
    let oldRecord = null;
    if (targetId) {
      const isNum = /^\d+$/.test(String(targetId));
      const oldCheck = isNum
        ? await poolTest.query(`SELECT id, macro_name FROM public.custom_macro_lines WHERE id = $1`, [parseInt(targetId, 10)])
        : await poolTest.query(`SELECT id, macro_name FROM public.custom_macro_lines WHERE UPPER(TRIM(macro_name)) = UPPER(TRIM($1))`, [String(targetId).trim()]);
      if (oldCheck.rows.length > 0) {
        oldRecord = oldCheck.rows[0];
      }
    }

    let saved = null;
    if (oldRecord) {
      const updateQuery = `
        UPDATE public.custom_macro_lines 
        SET macro_name = $1,
            sub_lines = $2,
            output_source_line = $3,
            position_before = $4,
            show_plan_row = $5,
            show_target_row = $6,
            show_ot_rows = $7,
            show_leave_rows = $8,
            units = $9,
            factory = $10,
            is_active = TRUE,
            updated_at = NOW()
        WHERE id = $11
        RETURNING *
      `;

      const updateRes = await poolTest.query(updateQuery, [
        cleanName,
        JSON.stringify(combinedSubLines),
        formattedOutputSource,
        position_before || null,
        show_plan_row !== false,
        show_target_row !== false,
        Boolean(show_ot_rows),
        Boolean(show_leave_rows),
        formattedUnits,
        cleanFactory,
        oldRecord.id
      ]);
      saved = updateRes.rows[0];

      if (oldRecord.macro_name && oldRecord.macro_name.trim().toUpperCase() !== cleanName.toUpperCase()) {
        try {
          await poolTest.query(
            `UPDATE public.productivity_period_summary SET line_group = $1, updated_at = NOW() WHERE UPPER(TRIM(line_group)) = UPPER(TRIM($2))`,
            [cleanName, oldRecord.macro_name.trim()]
          );
          console.log(`[MacroRename] Cascaded rename from ${oldRecord.macro_name} to ${cleanName}`);
        } catch (renameErr) {
          console.warn('[MacroRename] Error cascading rename to period summary:', renameErr.message);
        }
      }
    } else {
      const query = `
        INSERT INTO public.custom_macro_lines 
        (macro_name, sub_lines, output_source_line, position_before, show_plan_row, show_target_row, show_ot_rows, show_leave_rows, units, factory, is_active, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, NOW())
        ON CONFLICT (macro_name) 
        DO UPDATE SET 
          sub_lines = EXCLUDED.sub_lines,
          output_source_line = EXCLUDED.output_source_line,
          position_before = EXCLUDED.position_before,
          show_plan_row = EXCLUDED.show_plan_row,
          show_target_row = EXCLUDED.show_target_row,
          show_ot_rows = EXCLUDED.show_ot_rows,
          show_leave_rows = EXCLUDED.show_leave_rows,
          units = EXCLUDED.units,
          factory = EXCLUDED.factory,
          is_active = TRUE,
          updated_at = NOW()
        RETURNING *
      `;

      const { rows } = await poolTest.query(query, [
        cleanName,
        JSON.stringify(combinedSubLines),
        formattedOutputSource,
        position_before || null,
        show_plan_row !== false,
        show_target_row !== false,
        Boolean(show_ot_rows),
        Boolean(show_leave_rows),
        formattedUnits,
        cleanFactory
      ]);
      saved = rows[0];
    }
    let parsedOut = [];
    try {
      parsedOut = typeof saved.output_source_line === 'string' ? JSON.parse(saved.output_source_line) : (saved.output_source_line ? [saved.output_source_line] : []);
    } catch (e) {
      parsedOut = saved.output_source_line ? [saved.output_source_line] : [];
    }

    let parsedUnits = ['piece'];
    try {
      parsedUnits = typeof saved.units === 'string' ? JSON.parse(saved.units) : (Array.isArray(saved.units) ? saved.units : ['piece']);
    } catch (e) {}

    const responseData = {
      id: String(saved.id),
      line_name: saved.macro_name,
      display_name: saved.macro_name,
      factory: saved.factory || cleanFactory || 'SMT',
      output_sources: Array.isArray(parsedOut) ? parsedOut : [parsedOut],
      cost_center_sources: combinedSubLines,
      sub_line_sources: [],
      show_plan_row: saved.show_plan_row !== false,
      show_target_row: saved.show_target_row !== false,
      show_ot_rows: saved.show_ot_rows !== false,
      show_leave_rows: saved.show_leave_rows !== false,
      units: parsedUnits,
      is_active: saved.is_active !== false,
      updated_at: saved.updated_at
    };

    res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('Error saving dynamic macro line:', err.message);
    res.status(500).json({ success: false, error: 'Cannot save custom line', details: err.message });
  }
});

// DELETE /productivity/settings/dynamic-lines/:id & /productivity/settings/macro-lines/:id
router.delete([
  '/productivity/settings/dynamic-lines/:id',
  '/settings/dynamic-lines/:id',
  '/dynamic-lines/:id',
  '/productivity/settings/macro-lines/:id',
  '/settings/macro-lines/:id',
  '/macro-lines/:id'
], async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = /^\d+$/.test(id);
    let deletedName = id;
    if (isNum) {
      const { rows } = await poolTest.query(`SELECT macro_name FROM public.custom_macro_lines WHERE id = $1`, [parseInt(id, 10)]);
      if (rows.length > 0) deletedName = rows[0].macro_name;
      await poolTest.query(`DELETE FROM public.custom_macro_lines WHERE id = $1`, [parseInt(id, 10)]);
    } else {
      await poolTest.query(`DELETE FROM public.custom_macro_lines WHERE UPPER(TRIM(macro_name)) = UPPER(TRIM($1))`, [id]);
    }

    if (deletedName) {
      await poolTest.query(`DELETE FROM public.productivity_period_summary WHERE UPPER(TRIM(line_group)) = UPPER(TRIM($1))`, [deletedName]);
    }

    clearAllCacheSafely();

    // Trigger asynchronous period summary rollup
    import('../services/periodSummaryService.js')
      .then(({ syncProductivityPeriodSummary }) => syncProductivityPeriodSummary())
      .catch(err => console.error('Auto period rollup error on macro delete:', err.message));
    if (typeof syncProductivityPeriodSummary === 'function') {
      syncProductivityPeriodSummary().catch(err => console.error('Auto period rollup error on macro delete:', err.message));
    }

    res.json({ success: true, message: 'Custom macro line deleted and summary cleared' });
  } catch (err) {
    console.error('Error deleting custom macro line:', err.message);
    res.status(500).json({ success: false, error: 'Cannot delete custom macro line', details: err.message });
  }
});

// ---------------------------------------------------------
// Custom Line Names & Line Order Endpoints
// ---------------------------------------------------------
(async () => {
  try {
    await poolTest.query(`
      CREATE TABLE IF NOT EXISTS public.productivity_custom_line_names (
        id SERIAL PRIMARY KEY,
        line_key VARCHAR(255) UNIQUE NOT NULL,
        custom_name VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await poolTest.query(`
      CREATE TABLE IF NOT EXISTS public.productivity_custom_line_order (
        id SERIAL PRIMARY KEY,
        line_key VARCHAR(255) UNIQUE NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await poolTest.query(`
      CREATE TABLE IF NOT EXISTS public.productivity_table_visibility (
        id SERIAL PRIMARY KEY,
        hidden_tables JSONB NOT NULL DEFAULT '[]',
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (e) {}
})();

router.get(['/productivity/settings/custom-line-names', '/settings/custom-line-names'], async (req, res) => {
  try {
    const { rows } = await poolTest.query(`SELECT line_key, custom_name FROM public.productivity_custom_line_names`);
    const map = {};
    rows.forEach(r => { map[r.line_key] = r.custom_name; });
    res.json({ success: true, data: map });
  } catch (err) {
    res.json({ success: true, data: {} });
  }
});

router.post(['/productivity/settings/custom-line-names', '/settings/custom-line-names'], async (req, res) => {
  try {
    const { customNames } = req.body;
    if (customNames && typeof customNames === 'object') {
      for (const [key, name] of Object.entries(customNames)) {
        if (!key) continue;
        if (!name || name === key) {
          await poolTest.query(`DELETE FROM public.productivity_custom_line_names WHERE line_key = $1`, [key]);
        } else {
          await poolTest.query(`
            INSERT INTO public.productivity_custom_line_names (line_key, custom_name, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (line_key) DO UPDATE SET custom_name = EXCLUDED.custom_name, updated_at = NOW()
          `, [key, name]);
        }
      }
    }
    clearAllCacheSafely();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get(['/productivity/settings/custom-line-order', '/settings/custom-line-order'], async (req, res) => {
  try {
    const { rows } = await poolTest.query(`SELECT line_key FROM public.productivity_custom_line_order ORDER BY sort_order ASC`);
    const orderList = rows.map(r => r.line_key);
    res.json({ success: true, data: orderList });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

router.post(['/productivity/settings/custom-line-order', '/settings/custom-line-order'], async (req, res) => {
  try {
    const { order } = req.body;
    if (Array.isArray(order)) {
      await poolTest.query(`DELETE FROM public.productivity_custom_line_order`);
      for (let i = 0; i < order.length; i++) {
        const lineKey = order[i];
        if (!lineKey) continue;
        await poolTest.query(`
          INSERT INTO public.productivity_custom_line_order (line_key, sort_order, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (line_key) DO UPDATE SET sort_order = EXCLUDED.sort_order, updated_at = NOW()
        `, [lineKey, i]);
      }
    }
    clearAllCacheSafely();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get(['/productivity/settings/table-visibility', '/settings/table-visibility'], async (req, res) => {
  try {
    const { rows } = await poolTest.query(`SELECT hidden_tables FROM public.productivity_table_visibility ORDER BY id DESC LIMIT 1`);
    const hidden = rows.length > 0 && Array.isArray(rows[0].hidden_tables) ? rows[0].hidden_tables : [];
    res.json({ success: true, data: hidden });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

router.post(['/productivity/settings/table-visibility', '/settings/table-visibility'], async (req, res) => {
  try {
    const { hiddenTables } = req.body;
    const cleanList = Array.isArray(hiddenTables) ? hiddenTables : [];
    await poolTest.query(`DELETE FROM public.productivity_table_visibility`);
    await poolTest.query(`
      INSERT INTO public.productivity_table_visibility (hidden_tables, updated_at)
      VALUES ($1, NOW())
    `, [JSON.stringify(cleanList)]);
    clearAllCacheSafely();
    res.json({ success: true, data: cleanList });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------

// ---------------------------------------------------------
// Dynamic Lines Endpoints (Alias / Interface for Custom Macro Lines)
// ---------------------------------------------------------
router.get([
  '/productivity/settings/dynamic-lines',
  '/settings/dynamic-lines',
  '/dynamic-lines',
  '/productivity/settings/macro-lines',
  '/settings/macro-lines',
  '/macro-lines'
], async (req, res) => {
  try {
    const { rows } = await poolTest.query(`
      SELECT id, macro_name, macro_name as line_name, macro_name as display_name,
             sub_lines, output_source_line as output_sources, output_source_line,
             position_before, show_plan_row, show_target_row, show_ot_rows, show_leave_rows,
             units, factory, is_active, updated_at
      FROM public.custom_macro_lines
      WHERE is_active = TRUE
      ORDER BY id ASC
    `);
    const formatted = rows.map(r => {
      let sub = [];
      try { sub = typeof r.sub_lines === 'string' ? JSON.parse(r.sub_lines) : (r.sub_lines || []); } catch (e) {}
      let out = [];
      try { out = typeof r.output_sources === 'string' ? JSON.parse(r.output_sources) : (r.output_sources ? [r.output_sources] : []); } catch (e) {}
      let unts = ['piece'];
      try { unts = typeof r.units === 'string' ? JSON.parse(r.units) : (Array.isArray(r.units) ? r.units : ['piece']); } catch (e) {}
      return {
        id: String(r.id),
        line_name: r.line_name,
        display_name: r.display_name,
        factory: r.factory || 'SMT',
        output_sources: Array.isArray(out) ? out : [out],
        cost_center_sources: sub,
        sub_line_sources: [],
        show_plan_row: r.show_plan_row !== false,
        show_target_row: r.show_target_row !== false,
        show_ot_rows: r.show_ot_rows !== false,
        show_leave_rows: r.show_leave_rows !== false,
        units: unts,
        is_active: r.is_active !== false,
        updated_at: r.updated_at
      };
    });
    res.json({ success: true, data: formatted });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

// POST /productivity/settings/dynamic-lines & /productivity/settings/macro-lines (Create or Update)
router.post([
  '/productivity/settings/dynamic-lines',
  '/settings/dynamic-lines',
  '/dynamic-lines',
  '/productivity/settings/macro-lines',
  '/settings/macro-lines',
  '/macro-lines'
], async (req, res) => {
  try {
    const {
      macro_name,
      line_name,
      display_name,
      sub_lines,
      cost_center_sources,
      sub_line_sources,
      output_sources,
      output_source_line,
      position_before,
      show_plan_row,
      show_target_row,
      show_ot_rows,
      show_leave_rows,
      units,
      factory
    } = req.body;

    const cleanName = (line_name || display_name || macro_name || '').trim();
    if (!cleanName) {
      return res.status(400).json({ success: false, error: 'line_name is required' });
    }

    const combinedSubLines = Array.from(new Set([
      ...(Array.isArray(sub_lines) ? sub_lines : []),
      ...(Array.isArray(cost_center_sources) ? cost_center_sources : []),
      ...(Array.isArray(sub_line_sources) ? sub_line_sources : [])
    ])).filter(Boolean);

    const outSources = output_sources || output_source_line;
    let formattedOutputSource = '[]';
    let hasOutSources = false;
    if (Array.isArray(outSources)) {
      const validOuts = outSources.filter(Boolean);
      formattedOutputSource = JSON.stringify(validOuts);
      if (validOuts.length > 0) {
        hasOutSources = true;
      }
    } else if (typeof outSources === 'string' && outSources.trim()) {
      formattedOutputSource = outSources.trim();
      hasOutSources = true;
    }

    if (combinedSubLines.length === 0 && !hasOutSources) {
      return res.status(400).json({ success: false, error: 'At least one source (output or manpower) is required' });
    }

    const formattedUnits = Array.isArray(units) && units.length > 0 ? JSON.stringify(units) : JSON.stringify(['piece']);
    const cleanFactory = (factory || 'SMT').trim().toUpperCase();

    const query = `
      INSERT INTO public.custom_macro_lines 
      (macro_name, sub_lines, output_source_line, position_before, show_plan_row, show_target_row, show_ot_rows, show_leave_rows, units, factory, is_active, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, NOW())
      ON CONFLICT (macro_name) 
      DO UPDATE SET 
        sub_lines = EXCLUDED.sub_lines,
        output_source_line = EXCLUDED.output_source_line,
        position_before = EXCLUDED.position_before,
        show_plan_row = EXCLUDED.show_plan_row,
        show_target_row = EXCLUDED.show_target_row,
        show_ot_rows = EXCLUDED.show_ot_rows,
        show_leave_rows = EXCLUDED.show_leave_rows,
        units = EXCLUDED.units,
        factory = EXCLUDED.factory,
        is_active = TRUE,
        updated_at = NOW()
      RETURNING *
    `;

    const { rows } = await poolTest.query(query, [
      cleanName,
      JSON.stringify(combinedSubLines),
      formattedOutputSource,
      position_before || null,
      show_plan_row !== false,
      show_target_row !== false,
      Boolean(show_ot_rows),
      Boolean(show_leave_rows),
      formattedUnits,
      cleanFactory
    ]);

    clearAllCacheSafely();

    // Trigger background period summary rollup
    if (typeof syncProductivityPeriodSummary === 'function') {
      syncProductivityPeriodSummary().catch(err => console.error('Auto period rollup error on macro save:', err.message));
    }

    const saved = rows[0];
    let parsedOut = [];
    try {
      parsedOut = typeof saved.output_source_line === 'string' ? JSON.parse(saved.output_source_line) : (saved.output_source_line ? [saved.output_source_line] : []);
    } catch (e) {
      parsedOut = saved.output_source_line ? [saved.output_source_line] : [];
    }

    let parsedUnits = ['piece'];
    try {
      parsedUnits = typeof saved.units === 'string' ? JSON.parse(saved.units) : (Array.isArray(saved.units) ? saved.units : ['piece']);
    } catch (e) {}

    const responseData = {
      id: String(saved.id),
      line_name: saved.macro_name,
      display_name: saved.macro_name,
      factory: saved.factory || cleanFactory || 'SMT',
      output_sources: Array.isArray(parsedOut) ? parsedOut : [parsedOut],
      cost_center_sources: combinedSubLines,
      sub_line_sources: [],
      show_plan_row: saved.show_plan_row !== false,
      show_target_row: saved.show_target_row !== false,
      show_ot_rows: saved.show_ot_rows !== false,
      show_leave_rows: saved.show_leave_rows !== false,
      units: parsedUnits,
      is_active: saved.is_active !== false,
      updated_at: saved.updated_at
    };

    res.json({ success: true, data: responseData });
  } catch (err) {
    console.error('Error saving dynamic macro line:', err.message);
    res.status(500).json({ success: false, error: 'Cannot save custom line', details: err.message });
  }
});

// DELETE /productivity/settings/dynamic-lines/:id & /productivity/settings/macro-lines/:id
router.delete([
  '/productivity/settings/dynamic-lines/:id',
  '/settings/dynamic-lines/:id',
  '/dynamic-lines/:id',
  '/productivity/settings/macro-lines/:id',
  '/settings/macro-lines/:id',
  '/macro-lines/:id'
], async (req, res) => {
  try {
    const { id } = req.params;
    const isNum = /^\d+$/.test(id);
    let deletedName = id;
    if (isNum) {
      const { rows } = await poolTest.query(`SELECT macro_name FROM public.custom_macro_lines WHERE id = $1`, [parseInt(id, 10)]);
      if (rows.length > 0) deletedName = rows[0].macro_name;
      await poolTest.query(`DELETE FROM public.custom_macro_lines WHERE id = $1`, [parseInt(id, 10)]);
    } else {
      await poolTest.query(`DELETE FROM public.custom_macro_lines WHERE UPPER(TRIM(macro_name)) = UPPER(TRIM($1))`, [id]);
    }

    if (deletedName) {
      await poolTest.query(`DELETE FROM public.productivity_period_summary WHERE UPPER(TRIM(line_group)) = UPPER(TRIM($1))`, [deletedName]);
    }

    clearAllCacheSafely();

    if (typeof syncProductivityPeriodSummary === 'function') {
      syncProductivityPeriodSummary().catch(err => console.error('Auto period rollup error on macro delete:', err.message));
    }

    res.json({ success: true, message: 'Custom macro line deleted and summary cleared' });
  } catch (err) {
    console.error('Error deleting custom macro line:', err.message);
    res.status(500).json({ success: false, error: 'Cannot delete custom macro line', details: err.message });
  }
});

// Clear in-memory server cache endpoint
router.all(['/productivity/settings/clear-cache', '/settings/clear-cache'], (req, res) => {
  clearAllCacheSafely();
  res.json({ success: true, message: 'Server cache cleared successfully' });
});

// GET /productivity/settings/check-line-help (Verify Line Help connection & HR line mapping)
router.get(['/productivity/settings/check-line-help', '/settings/check-line-help', '/check-line-help'], async (req, res) => {
  try {
    const rawCc = String(req.query.cost_center_code || '').trim().toUpperCase();
    const lineOut = String(req.query.line_out || '').trim();
    const line = String(req.query.line || '').trim();
    const baseCode = rawCc.split('/')[0].trim();

    let detectedLine = lineOut || line || '';
    let foundInDb = false;

    // 1. Try querying MariaDB tbl_help
    try {
      if (mariaPool) {
        const mariaRowsRaw = await mariaPool.query(
          `SELECT DISTINCT TRIM(cost_center) as cost_center, TRIM(line_in) as hr_line, TRIM(line_out) as hr_dept
           FROM tbl_help
           WHERE cost_center IS NOT NULL AND (
             UPPER(TRIM(cost_center)) = ? OR
             UPPER(TRIM(SUBSTRING_INDEX(cost_center, '/', 1))) = ?
           )
           LIMIT 1`,
          [rawCc, baseCode]
        );
        const mariaRows = Array.isArray(mariaRowsRaw) ? (Array.isArray(mariaRowsRaw[0]) ? mariaRowsRaw[0] : mariaRowsRaw) : [];
        if (mariaRows.length > 0) {
          foundInDb = true;
          detectedLine = (mariaRows[0].hr_line || mariaRows[0].hr_dept || '').trim() || detectedLine;
        }
      }
    } catch (mariaErr) {
      console.warn('[CheckLineHelp] MariaDB query error:', mariaErr.message);
    }

    // 2. Fallback to public.cost_centers in PostgreSQL if not found in MariaDB
    if (!foundInDb && baseCode) {
      try {
        const { rows: pgRows } = await poolTest.query(
          `SELECT line_out, line, process FROM public.cost_centers 
           WHERE UPPER(TRIM(cost_center_code)) = $1 OR UPPER(TRIM(SPLIT_PART(cost_center_code, '/', 1))) = $1
           LIMIT 1`,
          [baseCode]
        );
        if (pgRows && pgRows.length > 0) {
          foundInDb = true;
          detectedLine = (pgRows[0].line_out || pgRows[0].line || '').trim() || detectedLine;
        }
      } catch (pgErr) {
        console.warn('[CheckLineHelp] Postgres fallback error:', pgErr.message);
      }
    }

    const normDetected = detectedLine.trim().toUpperCase();
    const normLineOut = lineOut.trim().toUpperCase();
    const lineMismatch = foundInDb && !!normDetected && !!normLineOut && normDetected !== normLineOut;

    res.json({
      success: true,
      status: lineMismatch ? 'MISMATCH' : (foundInDb ? 'READY' : 'NEW'),
      lineMismatch,
      detectedLine: detectedLine || lineOut,
      cost_center_code: rawCc,
      line_out: lineOut
    });
  } catch (err) {
    console.error('[CheckLineHelp] Error:', err.message);
    res.status(500).json({ error: 'Cannot check Line Help connection', details: err.message });
  }
});

// ============================================================================
// MANPOWER SNAPSHOT & COST CENTER RETROACTIVE ADJUSTMENTS (Synced from Dev)
// ============================================================================

// GET Manpower Snapshot records for a specific date (with auto-initialization if empty)
router.get(['/productivity/manpower-snapshot', '/manpower-snapshot'], async (req, res) => {
  try {
    const { date, search, dept, shift, line_name, department } = req.query;
    const { todayStr } = getThaiTimeInfo();
    const targetDate = date || todayStr;

    // Future dates cannot have manpower snapshots
    if (targetDate > todayStr) {
      return res.json({
        success: true,
        date: targetDate,
        total: 0,
        rows: [],
        message: 'Future dates do not have manpower snapshot data'
      });
    }

    // 1. Check if snapshot exists for targetDate; if empty, initialize from baseline
    const countCheck = await poolTest.query(
      'SELECT count(*)::int as count FROM public.manpower_snapshot WHERE snapshot_date = $1',
      [targetDate]
    );

    if (countCheck.rows[0].count === 0) {
      try {
        const { syncSmartManpower } = require('../../../../../../services/productivity/snapshotManager');
        await syncSmartManpower(targetDate, 'on_demand_init');
      } catch (initErr) {
        console.warn(`[ManpowerSnapshot] On-demand initialization warning for ${targetDate}:`, initErr.message);
      }
    }

    // 2. Query snapshot with filters and dynamically fallback line_out from cost_centers if empty
    let sql = `
      SELECT 
        s.id, 
        s.employee_code, 
        s.employee_name, 
        s.department, 
        s.dept, 
        s.shift, 
        s.line_name, 
        COALESCE(
          NULLIF(TRIM(s.line_out), ''),
          NULLIF(TRIM(c.line_out), ''),
          CASE WHEN s.line_name IS NOT NULL AND TRIM(s.line_name) != '' AND s.shift IS NOT NULL AND TRIM(s.shift) != ''
               THEN TRIM(s.line_name) || '/' || TRIM(s.shift)
               ELSE NULLIF(TRIM(s.line_name), '')
          END
        ) AS line_out, 
        s.snapshot_date::text AS snapshot_date, 
        s.updated_at
      FROM public.manpower_snapshot s
      LEFT JOIN public.cost_centers c
        ON UPPER(TRIM(c.cost_center_code)) = UPPER(TRIM(SUBSTRING(s.department FROM '^[A-Za-z0-9-]+')))
           OR UPPER(TRIM(c.cost_center_name)) = UPPER(TRIM(s.department))
      WHERE s.snapshot_date = $1
    `;
    const params = [targetDate];
    let pIdx = 2;

    if (search && search.trim()) {
      sql += ` AND (s.employee_code ILIKE $${pIdx} OR s.employee_name ILIKE $${pIdx})`;
      params.push(`%${search.trim()}%`);
      pIdx++;
    }

    if (dept && dept !== 'ALL') {
      sql += ` AND UPPER(s.dept) = UPPER($${pIdx})`;
      params.push(dept.trim());
      pIdx++;
    }

    if (shift && shift !== 'ALL') {
      sql += ` AND UPPER(s.shift) = UPPER($${pIdx})`;
      params.push(shift.trim());
      pIdx++;
    }

    if (line_name && line_name !== 'ALL') {
      sql += ` AND UPPER(s.line_name) = UPPER($${pIdx})`;
      params.push(line_name.trim());
      pIdx++;
    }

    if (department && department !== 'ALL') {
      sql += ` AND (s.department ILIKE $${pIdx} OR s.department ILIKE $${pIdx + 1})`;
      params.push(`${department.trim()}%`);
      params.push(`%${department.trim()}%`);
      pIdx += 2;
    }

    sql += ` ORDER BY s.employee_code ASC`;

    const { rows } = await poolTest.query(sql, params);
    res.json({
      success: true,
      date: targetDate,
      total: rows.length,
      rows
    });
  } catch (error) {
    console.error('Error fetching manpower snapshot:', error);
    res.status(500).json({ error: 'Failed fetching manpower snapshot', details: error.message });
  }
});

// GET Cost Center Lookup List for auto-filling dept, shift, line_name, line_out
router.get(['/productivity/cost-center-lookup', '/cost-center-lookup'], async (req, res) => {
  try {
    const ccMap = new Map();

    // 1. Fetch from public.cost_centers
    const { rows: ccRows } = await poolTest.query(`
      SELECT cost_center_code, cost_center_name, type, process, line, ship, line_out
      FROM public.cost_centers
      ORDER BY cost_center_code ASC
    `);

    ccRows.forEach(r => {
      const code = (r.cost_center_code || '').trim().toUpperCase();
      const name = (r.cost_center_name || '').trim();
      const key = name || code;
      if (!key) return;

      let defaultDept = 'FPC';
      const uName = name.toUpperCase();
      const uLine = (r.line || '').toUpperCase();
      const uProc = (r.process || '').toUpperCase();

      if (uProc === 'MOT' || uName.includes('SMT-MOT') || uLine.startsWith('MOT')) {
        defaultDept = 'SMT_F';
      } else if (uName.includes('SMT') || uLine.includes('ASY') || uLine.includes('BLK-2') || uLine.includes('BLK2')) {
        defaultDept = 'SMT_B';
      } else if (uName.includes('QC') || uName.includes('QA') || uName.includes('OQI') || uProc === 'QC') {
        defaultDept = 'QA';
      } else if (uName.includes('NPM') || uLine.includes('NPM')) {
        defaultDept = 'NPM';
      }

      ccMap.set(key, {
        cost_center_code: code,
        cost_center_name: name || code,
        dept: defaultDept,
        shift: (r.ship || 'D').trim().toUpperCase(),
        line_name: (r.line || '').trim(),
        line_out: (r.line_out || '').trim(),
        type: r.type || 'DIRECT'
      });
    });

    // 2. Merge ground truth from public.manpower_snapshot
    const { rows: snapRows } = await poolTest.query(`
      SELECT department, dept, shift, line_name, line_out
      FROM public.manpower_snapshot
      WHERE department IS NOT NULL AND TRIM(department) != ''
      GROUP BY department, dept, shift, line_name, line_out
    `);

    snapRows.forEach(s => {
      const name = s.department.trim();
      if (!name) return;
      const code = name.split('/')[0].trim().toUpperCase();
      const existing = ccMap.get(name) || ccMap.get(code);

      ccMap.set(name, {
        cost_center_code: existing?.cost_center_code || code,
        cost_center_name: name,
        dept: s.dept || existing?.dept || 'FPC',
        shift: (s.shift || existing?.shift || 'D').trim().toUpperCase(),
        line_name: s.line_name || existing?.line_name || '',
        line_out: s.line_out || existing?.line_out || '',
        type: existing?.type || 'DIRECT'
      });
    });

    const result = Array.from(ccMap.values()).sort((a, b) =>
      a.cost_center_code.localeCompare(b.cost_center_code) || a.cost_center_name.localeCompare(b.cost_center_name)
    );

    res.json(result);
  } catch (error) {
    console.error('Error fetching cost center lookup:', error);
    res.status(500).json({ error: 'Failed fetching cost centers', details: error.message });
  }
});

// POST Batch Update Manpower Snapshot (Cost Center / Dept / Shift / Line adjustments)
router.post(['/productivity/save-manpower-snapshot', '/save-manpower-snapshot'], async (req, res) => {
  try {
    const { date, updates } = req.body;
    if (!date || !updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Missing date or updates array' });
    }

    const { todayStr } = getThaiTimeInfo();
    if (date > todayStr) {
      return res.status(400).json({ error: 'Cannot modify snapshot for future dates' });
    }

    const client = await poolTest.connect();
    let updatedCount = 0;

    try {
      await client.query('BEGIN');

      for (const u of updates) {
        if (!u.employee_code) continue;
        const code = String(u.employee_code).trim();
        const deptName = (u.department || '').trim();
        const dept = (u.dept || '').trim();
        const shift = (u.shift || '').trim().toUpperCase();
        const lineName = (u.line_name || '').trim();
        const lineOut = (u.line_out || (lineName ? `${lineName}/${shift}` : '')).trim();

        const updateRes = await client.query(`
          UPDATE public.manpower_snapshot
          SET department = $1,
              dept = $2,
              shift = $3,
              line_name = $4,
              line_out = $5,
              updated_at = NOW()
          WHERE snapshot_date = $6 AND employee_code = $7
        `, [deptName, dept, shift, lineName, lineOut, date, code]);

        if (updateRes.rowCount > 0) {
          updatedCount++;
        }
      }

      await client.query(`
        INSERT INTO public.manpower_snapshot_log (snapshot_date, sync_type, total_records)
        VALUES ($1, $2, $3)
      `, [date, `USER_COST_CENTER_EDIT(${updatedCount})`, updatedCount]);

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    // Trigger asynchronous period summary re-calculation for this date
    try {
      if (typeof syncProductivityPeriodSummary === 'function') {
        syncProductivityPeriodSummary().catch(e =>
          console.warn('[ManpowerSnapshot] Post-edit period summary rollup warning:', e.message)
        );
      }
    } catch (_) {}

    res.json({ success: true, count: updatedCount, date });
  } catch (error) {
    console.error('Error saving manpower snapshot updates:', error);
    res.status(500).json({ error: 'Failed saving manpower snapshot updates', details: error.message });
  }
});


// POST Import Manpower Snapshot from Excel / Custom list
router.post(['/productivity/import-manpower-snapshot', '/import-manpower-snapshot'], async (req, res) => {
  try {
    const { date, employees } = req.body;
    if (!date || !employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: 'Missing date or employees array' });
    }

    const { todayStr } = getThaiTimeInfo();
    if (date > todayStr) {
      return res.status(400).json({ error: 'Cannot import snapshot for future dates' });
    }

    const { insertSnapshotBatch } = require('../../../../../../services/productivity/snapshotManager');
    const client = await poolTest.connect();
    try {
      await client.query('BEGIN');
      await insertSnapshotBatch(client, date, employees);
      await client.query(`
        INSERT INTO public.manpower_snapshot_log (snapshot_date, sync_type, total_records)
        VALUES ($1, $2, $3)
      `, [date, `EXCEL_IMPORT(${employees.length})`, employees.length]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Invalidate attendance snapshot cache for this date so reports recompute freshly
    try {
      const { invalidateAttendanceSnapshots } = require('../../../../../../services/productivity/attendanceComputeService');
      if (typeof invalidateAttendanceSnapshots === 'function') {
        await invalidateAttendanceSnapshots(date, date);
      }
    } catch (_) {}

    // Trigger asynchronous period summary re-calculation
    try {
      if (typeof syncProductivityPeriodSummary === 'function') {
        syncProductivityPeriodSummary().catch(e =>
          console.warn('[ManpowerSnapshot] Post-import period summary rollup warning:', e.message)
        );
      }
    } catch (_) {}

    res.json({ success: true, count: employees.length, date });
  } catch (error) {
    console.error('Error importing manpower snapshot:', error);
    res.status(500).json({ error: 'Failed importing manpower snapshot', details: error.message });
  }
});

// POST Copy Manpower Snapshot from one date to another
router.post(['/productivity/copy-manpower-snapshot', '/copy-manpower-snapshot'], async (req, res) => {
  try {
    const { sourceDate, targetDate } = req.body;
    if (!sourceDate || !targetDate) {
      return res.status(400).json({ error: 'Missing sourceDate or targetDate' });
    }

    const { todayStr } = getThaiTimeInfo();
    if (targetDate > todayStr) {
      return res.status(400).json({ error: 'Cannot copy snapshot to a future date' });
    }

    const client = await poolTest.connect();
    let copiedCount = 0;
    try {
      await client.query('BEGIN');

      const copyRes = await client.query(`
        INSERT INTO public.manpower_snapshot (
          snapshot_date, employee_code, employee_name, department, shift, line_name, dept, line_out, updated_at
        )
        SELECT 
          $1::date, employee_code, employee_name, department, shift, line_name, dept, line_out, NOW()
        FROM public.manpower_snapshot
        WHERE snapshot_date = $2::date
        ON CONFLICT (snapshot_date, employee_code) DO UPDATE SET
          employee_name = EXCLUDED.employee_name,
          department = EXCLUDED.department,
          shift = EXCLUDED.shift,
          line_name = EXCLUDED.line_name,
          dept = EXCLUDED.dept,
          line_out = COALESCE(NULLIF(EXCLUDED.line_out, ''), public.manpower_snapshot.line_out),
          updated_at = NOW()
      `, [targetDate, sourceDate]);

      copiedCount = copyRes.rowCount || 0;

      await client.query(`
        INSERT INTO public.manpower_snapshot_log (snapshot_date, sync_type, total_records)
        VALUES ($1, $2, $3)
      `, [targetDate, `COPY_FROM_${sourceDate}(${copiedCount})`, copiedCount]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Invalidate attendance snapshot cache for targetDate
    try {
      const { invalidateAttendanceSnapshots } = require('../../../../../../services/productivity/attendanceComputeService');
      if (typeof invalidateAttendanceSnapshots === 'function') {
        await invalidateAttendanceSnapshots(targetDate, targetDate);
      }
    } catch (_) {}

    // Trigger asynchronous period summary re-calculation
    try {
      if (typeof syncProductivityPeriodSummary === 'function') {
        syncProductivityPeriodSummary().catch(e =>
          console.warn('[ManpowerSnapshot] Post-copy period summary rollup warning:', e.message)
        );
      }
    } catch (_) {}

    res.json({ success: true, count: copiedCount, sourceDate, targetDate });
  } catch (error) {
    console.error('Error copying manpower snapshot:', error);
    res.status(500).json({ error: 'Failed copying manpower snapshot', details: error.message });
  }
});

module.exports = router;
