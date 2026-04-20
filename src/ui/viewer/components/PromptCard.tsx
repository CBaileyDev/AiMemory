import React, { memo } from 'react';
import { UserPrompt } from '../types';
import { BaseCard } from './BaseCard';
import { Badge } from './primitives';

interface PromptCardProps {
  prompt: UserPrompt;
  pulseOnMount?: boolean;
}

function PromptCardImpl({ prompt, pulseOnMount }: PromptCardProps) {
  return (
    <BaseCard
      id={prompt.id}
      idPrefix="prompt"
      source={prompt.platform_source}
      project={prompt.project}
      type="prompt"
      typeBadge={<Badge tone="info" caps>prompt</Badge>}
      createdAtEpoch={prompt.created_at_epoch}
      accent="prompt"
      pulseOnMount={pulseOnMount}
    >
      <p className="am-card__narrative">{prompt.prompt_text}</p>
    </BaseCard>
  );
}

export const PromptCard = memo(PromptCardImpl, (prev, next) =>
  prev.prompt.id === next.prompt.id &&
  prev.pulseOnMount === next.pulseOnMount
);
