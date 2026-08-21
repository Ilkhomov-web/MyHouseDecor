/**
 * Builds the WHERE clause shared by the expense list and the Excel export, so
 * an export always covers exactly the rows the user is looking at.
 *
 * Every value goes in as a bound parameter — nothing from the query string is
 * concatenated into SQL.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function buildExpenseFilter(query = {}) {
  const clauses = [];
  const params = [];

  const from = String(query.from || '').trim();
  if (ISO_DATE.test(from)) {
    clauses.push('expense_date >= ?');
    params.push(from);
  }

  const to = String(query.to || '').trim();
  if (ISO_DATE.test(to)) {
    clauses.push('expense_date <= ?');
    params.push(to);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}
