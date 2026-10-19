import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-pg-soundings',
    version: '1.15.1',
    icon: '🪂',
    title: 'WS Sounding',
    description:
        'Paragliding forecast: wind and thermals by altitude and hour (ceiling, cumulus, rain, front passages) and a skewed sounding. English and French.',
    author: 'WeSoar',
    desktopUI: 'rhpane',
    desktopWidth: 820,
    mobileUI: 'fullscreen',
    routerPath: '/pg-soundings/:lat?/:lon?',
    addToContextmenu: true,
    listenToSingleclick: true,
    private: false,
};

export default config;
