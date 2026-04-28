'use client';

import { AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type LabelVariant = 'reconnect' | 'permission' | 'syncing';

interface ProfileLabelProps {
  variant: LabelVariant;
  profileName: string;
}

const LABEL_CONFIG: Record<LabelVariant, {
  text: string;
  bg: string;
  textColor: string;
  icon: React.ReactNode;
}> = {
  reconnect: {
    text: 'Reconnect profile',
    bg: 'bg-[#FCE7E9]',
    textColor: 'text-[#CE091C]',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  permission: {
    text: 'Permission needed',
    bg: 'bg-[#FCE7E9]',
    textColor: 'text-[#CE091C]',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  syncing: {
    text: 'Syncing Data',
    bg: 'bg-[#FFF3CD]',
    textColor: 'text-[#806104]',
    icon: <Clock className="w-3 h-3" />,
  },
};

export function ProfileLabel({ variant, profileName }: ProfileLabelProps) {
  const config = LABEL_CONFIG[variant];
  return (
    <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full', config.bg)}>
      <span className={config.textColor}>{config.icon}</span>
      <span className={cn('text-[11px] font-medium', config.textColor)}>
        {profileName} · {config.text}
      </span>
    </div>
  );
}

// Demo/showcase component for all label states
export function ProfileLabelsShowcase() {
  return (
    <div className="flex flex-col gap-2 p-4">
      <ProfileLabel variant="reconnect" profileName="BrandHQ Page" />
      <ProfileLabel variant="permission" profileName="brandhq" />
      <ProfileLabel variant="syncing" profileName="BrandHQ TikTok" />
    </div>
  );
}
