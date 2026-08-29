import { dueDates } from './period'
import { describeTransaction, logActivities } from './activity'
import { newId, nowISO } from './storage'

/**
 * Builds any transactions an active rule owes, then reports how far each rule
 * has caught up so the caller can advance its watermark.
 *
 * Safe to run on every load: dueDates() starts from last_created_on, and any
 * date a rule has already posted is skipped by fingerprint. The database used
 * to enforce that with a unique index; with no database, the existing ledger is
 * the thing being deduplicated against.
 *
 * Pure — it returns rows rather than saving them, so the caller stays the only
 * writer and one failed save cannot leave the ledger half-updated.
 */
export function materialiseRecurring(ruleList, existing) {
  const rows = []
  const touched = {}

  const seen = new Set(
    existing
      .filter(item => item.recurring_rule_id)
      .map(item => `${item.recurring_rule_id}|${item.date}`)
  )

  for (const rule of ruleList) {
    if (!rule.active) continue

    const dates = dueDates(rule)
    if (dates.length === 0) continue

    for (const date of dates) {
      const fingerprint = `${rule.id}|${date}`
      if (seen.has(fingerprint)) continue
      seen.add(fingerprint)

      rows.push({
        id: newId(),
        recurring_rule_id: rule.id,
        description: rule.description,
        amount: rule.amount,
        type: rule.type,
        category: rule.category,
        note: rule.note,
        date,
        created_at: nowISO(),
      })
    }

    // Advances even when every date was already posted: the rule really has
    // caught up to here, and re-deriving the same skipped dates on every load
    // is wasted work.
    touched[rule.id] = dates[dates.length - 1]
  }

  // These never go through addTransaction, so without this they would appear in
  // the ledger with nothing in the log explaining where they came from.
  logActivities(
    rows.map(row => ({
      action: 'created',
      entity: 'transaction',
      entity_id: row.id,
      summary: 'Recurring rule added a transaction',
      detail: describeTransaction(row),
    }))
  )

  return { rows, touched }
}
