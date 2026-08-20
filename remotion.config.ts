/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { enableTailwind } from '@remotion/tailwind-v4';


Config.setStudioPort(3000);
Config.setChromiumOpenGlRenderer('angle');
Config.setConcurrency(1);


Config.setStudioPort(3000);
Config.setChromiumOpenGlRenderer('angle');
Config.setConcurrency(1);


Config.setStudioPort(3000);
Config.setChromiumOpenGlRenderer('angle');


Config.setStudioPort(3000);


Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.overrideBundlerConfig(enableTailwind);
Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
Config.setConcurrency(1); // Crucial for MapLibre WebGL: prevents race conditions during render
