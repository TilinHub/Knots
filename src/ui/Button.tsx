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
  height: '32px', // Slightly smaller/compact
  padding: '0 16px',
  border: 'none',
  borderRadius: '6px',
  fontSize: '13px', // Apple apps often use 13px/14px
  fontWeight: 500,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  transition: 'all 0.2s ease',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  lineHeight: '1',
};

const primaryStyle: React.CSSProperties = {
  background: '#0071E3', // Apple Blue
  color: 'white',
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
};

const secondaryStyle: React.CSSProperties = {
  background: '#FFFFFF',
  color: '#1D1D1F',
  border: '1px solid #D2D2D7',
  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
};
