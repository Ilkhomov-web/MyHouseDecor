/**
 * Builds the WHERE clause shared by the sales list and the Excel export, so an
 * export always covers exactly the rows the user is looking at.
 *
 * Every value goes in as a bound parameter — nothing from the query string is
 * concatenated into SQL.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function buildSalesFilter(query = {}) {
  const clauses = [];
  const params = [];

  const from = String(query.from || '').trim();
  if (ISO_DATE.test(from)) {
    clauses.push('s.sale_date >= ?');
    params.push(from);
  }

  const to = String(query.to || '').trim();
  if (ISO_DATE.test(to)) {
    clauses.push('s.sale_date <= ?');
    params.push(to);
  }

  // 'active' | 'returned' | anything else means no filter
  const status = String(query.status || '').trim();
  if (status === 'active' || status === 'returned') {
    clauses.push('s.status = ?');
    params.push(status);
  }

  // 'paid' | 'debt'
  const payment = String(query.payment || '').trim();
  if (payment === 'paid' || payment === 'debt') {
    clauses.push('s.payment_status = ?');
    params.push(payment);
  }

  const seller = Number(query.seller_id);
  if (Number.isInteger(seller) && seller > 0) {
    clauses.push('s.seller_id = ?');
    params.push(seller);
  }

  const q = String(query.q || '').trim();
  if (q) {
    const like = `%${q}%`;
    clauses.push('(p.name LIKE ? OR s.customer_name LIKE ? OR s.seller_name LIKE ?)');
    params.push(like, like, like);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}
