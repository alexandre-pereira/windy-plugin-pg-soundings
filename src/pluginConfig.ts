import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-pg-soundings',
    version: '1.3.0',
    icon: '🪂',
    title: 'PG Soundings',
    description:
        'Paragliding forecast: wind and thermals by altitude and hour (ceiling, cumulus, rain), skewed sounding, and a map of the best take-offs for free-distance or out-and-return cross-country flights. English and French.',
    author: 'Alexandre Pereira',
    desktopUI: 'rhpane',
    desktopWidth: 820,
    mobileUI: 'fullscreen',
    routerPath: '/pg-soundings/:lat?/:lon?',
    addToContextmenu: true,
    listenToSingleclick: true,
    private: false,
};

export default config;
