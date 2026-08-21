export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Topilmadi.' });
}

export function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  const message = err.expose ? err.message : 'Serverda xatolik yuz berdi.';
  res.status(status).json({ error: message });
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
