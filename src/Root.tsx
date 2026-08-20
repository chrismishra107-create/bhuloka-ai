import React from 'react';
import { Composition } from 'remotion';
import { MapAnimation } from './MapAnimation';
import timelineData from './dynamicTimeline.json';

export const Root: React.FC = () => {
  const frames = timelineData.totalFrames || 300;

  return (
    <Composition
      id="Map3D"
      component={MapAnimation}
      durationInFrames={frames}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        timeline: timelineData as any,
      }}
    />
  );
};