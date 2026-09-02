'use client';

import { useState } from 'react';
import LiveMode from '../creator/LiveMode';
import ModeSwitcher from '../creator/ModeSwitcher';
import StudioMode from '../creator/StudioMode';
import SectionBackButton from '../SectionBackButton';

/** Creator section — dedicated screen for Creator mode listening. */
export default function CreatorSection() {
  const [activeMode, setActiveMode] = useState('live');

  return (
    <div id="creatorSection" className="app-section hidden">
      <div className="section-header">
        <SectionBackButton />
        <h2>Creator</h2>
      </div>
      <div className="section-body">
        {/* Hidden mode button — auto-clicked by engine when entering this section */}
        <button className="mode-btn hidden" data-mode="creator" data-auto-select="true" style={{ display: 'none' }}>Creator</button>

        <ModeSwitcher activeMode={activeMode} onChange={setActiveMode} />
        <LiveMode active={activeMode === 'live'} />
        <StudioMode active={activeMode === 'studio'} />
      </div>
    </div>
  );
}
