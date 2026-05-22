import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { theme } = useTheme();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Demo: accept any login
    onLogin({ email, name: email.split('@')[0] });
    setIsLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="logo">Calo<span>Scan</span>Ai</h1>
          <p className="subtitle">AI 智慧熱量追蹤，拍照記錄每一餐</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">電子郵件</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="請輸入電子郵件"
              required
              className="input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">密碼</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="請輸入密碼"
              required
              className="input"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-login" disabled={isLoading}>
            {isLoading ? '登入中...' : '登入'}
          </button>
        </form>

        <div className="divider">
          <span>或</span>
        </div>

        <div className="register-link">
          還沒有帳號？<a href="#">立即註冊</a>
        </div>
      </div>

      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: var(--color-bg);
        }

        .login-container {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-xl);
          padding: 48px;
          width: 100%;
          max-width: 420px;
          box-shadow: var(--shadow-lg);
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .logo {
          font-family: var(--font-family-display);
          font-size: 2rem;
          font-weight: var(--font-weight-bold);
          color: var(--logo-color);
          margin-bottom: 8px;
        }

        .logo span {
          color: var(--logo-accent);
        }

        .subtitle {
          color: var(--color-text-muted);
          font-size: 0.95rem;
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          font-size: 0.85rem;
          font-weight: var(--font-weight-medium);
          color: var(--color-text);
        }

        .btn-login {
          width: 100%;
          padding: 16px;
          margin-top: 8px;
          font-size: 1rem;
          font-weight: var(--font-weight-bold);
        }

        .divider {
          display: flex;
          align-items: center;
          gap: 16px;
          margin: 24px 0;
          color: var(--color-text-light);
          font-size: 0.8rem;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--color-border);
        }

        .register-link {
          text-align: center;
          color: var(--color-text-muted);
          font-size: 0.9rem;
        }

        .register-link a {
          color: var(--color-primary);
          font-weight: var(--font-weight-semibold);
          text-decoration: none;
        }

        .register-link a:hover {
          color: var(--color-primary-light);
        }
      `}</style>
    </div>
  );
}