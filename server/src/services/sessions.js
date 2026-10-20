// Small helpers around express-session (which uses callbacks) plus the
// "log this user out everywhere" function used when access is taken away.

export const regenerateSession = (req) =>
  new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));

export const saveSession = (req) =>
  new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));

export const destroySession = (req) =>
  new Promise((resolve) => req.session.destroy(() => resolve()));

// Delete EVERY session that belongs to one user, so every device is logged out at once.
// The session row stores { userId, cookie } as JSON; this is the only raw SQL in the project
// and the user id is passed as a parameter ($1), never concatenated.
export async function destroyUserSessions(pool, userId) {
  await pool.query(`DELETE FROM session WHERE sess ->> 'userId' = $1`, [userId]);
}
