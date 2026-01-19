import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  type?: 'button' | 'submit';
}

/**
 * Botón base con estilo minimalista Apple
 */
export function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  disabled = false,
  type = 'button',
  style: externalStyle,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...baseStyle,
        ...(variant === 'primary' ? primaryStyle : secondaryStyle),
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...externalStyle,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

const baseStyle: React.CSSProperties = {
  height: '36px',
  padding: '0 16px',
  border: 'none',
  borderRadius: '8px',
  fontSize: 'var(--fs-body)',
  fontWeight: 'var(--fw-medium)',
  transition: 'opacity 0.15s ease',
};

const primaryStyle: React.CSSProperties = {
  background: 'var(--text-primary)',
  color: 'white',
};

const secondaryStyle: React.CSSProperties = {
  background: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
};
