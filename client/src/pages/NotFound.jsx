import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page">
      <div className="empty-state">
        <h2 style={{ marginBottom: 8 }}>Sahifa topilmadi</h2>
        <p className="text-muted" style={{ marginBottom: 16 }}>
          Siz izlagan sahifa mavjud emas.
        </p>
        <Link to="/" className="btn btn-primary">
          Bosh sahifaga qaytish
        </Link>
      </div>
    </div>
  );
}
