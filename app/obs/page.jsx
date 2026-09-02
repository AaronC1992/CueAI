import ObsClient from '../../components/ObsClient';

export const dynamic = 'force-dynamic';

/**
 * OBS Browser Source page — a minimal transparent background wrapper
 * that runs the SuiteRhythm engine for audio capture by OBS Studio.
 */
export default function ObsPage() {
  return <ObsClient />;
}
