// Central memo status constants (non-breaking)
// Map existing statuses to clearer names; keep original text values for DB compatibility

const MEMO_STATUS = Object.freeze({
  PENDING_ADMIN: 'pending',   // previously 'pending' for secretary-created memos
  APPROVED: 'approved',       // new marker; optional, intermediate
  REJECTED: 'rejected',       // new marker
  SENT: 'sent',               // already used
  DELETED: 'deleted',         // existing for trash
});

module.exports = { MEMO_STATUS };


