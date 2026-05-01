import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
}

export function LoadingSpinner({ size = 'medium', text }: LoadingSpinnerProps) {
  const sizeMap = {
    small: { icon: 24, padding: 'py-4' },
    medium: { icon: 32, padding: 'py-12' },
    large: { icon: 48, padding: 'py-20' },
  };

  const sizeConfig = sizeMap[size];

  return (
    <div className={`flex flex-col items-center justify-center ${sizeConfig.padding}`}>
      <Loader2 size={sizeConfig.icon} className="animate-spin text-primary mb-4" />
      {text && <p className="text-on-surface-variant text-sm">{text}</p>}
    </div>
  );
}

