function dailyLimitDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function dailyLimitDocId(uid, action, day = dailyLimitDateKey()) {
  const safeUid = String(uid).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 120);
  const safeAction = String(action).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80);
  return `${safeUid}_${safeAction}_${day}`;
}

module.exports = {
  dailyLimitDateKey,
  dailyLimitDocId
};
